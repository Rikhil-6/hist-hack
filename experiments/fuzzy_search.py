import sqlite3
import json
import numpy as np
from sentence_transformers import SentenceTransformer, util
from keybert import KeyBERT

# 1. Initialize High-Fidelity Models
kw_model = KeyBERT()
search_model = SentenceTransformer('all-MiniLM-L6-v2')

class HistoricalDocCorpus:
    def __init__(self, db_path="historical_corpus.db", reset=False):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        if reset:
            self._reset_db()
        self._setup_db()

    def _setup_db(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                ocr_text TEXT,
                dense_keywords TEXT,
                semantic_vector BLOB
            )
        ''')
        self.conn.commit()

    def _reset_db(self):
        cursor = self.conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS documents")
        self.conn.commit()

    def _get_ultra_dense_keywords(self, text, top_n=5):
        """
        Aggressively filters keywords. If a word (like 'flanking') is used in 
        one keyword, it cannot be used in another.
        """
        candidates = kw_model.extract_keywords(
            text, 
            keyphrase_ngram_range=(1, 2), 
            stop_words='english', 
            top_n=30 # Get a big pool to filter from
        )
        
        unique_keywords = []
        used_words = set() # Track individual words we've already committed to
        
        for cand, score in candidates:
            # Split the candidate into individual words (e.g., 'flanking', 'maneuver')
            cand_words = set(cand.lower().split())
            
            # If ANY word in this candidate has already been used, skip it
            if not cand_words.intersection(used_words):
                unique_keywords.append(cand)
                used_words.update(cand_words) # Mark these words as "used"
            
            if len(unique_keywords) >= top_n:
                break
                
        return unique_keywords

    def ingest_document(self, filename, text):
        # 1. Generate Non-Overlapping Keywords using the new 'Set' logic
        keywords = self._get_ultra_dense_keywords(text)
        
        # 2. Generate Semantic Vector (Binary Blob for space efficiency)
        vector = search_model.encode(text).astype(np.float32)

        cursor = self.conn.cursor()
        cursor.execute(
            "INSERT INTO documents (filename, ocr_text, dense_keywords, semantic_vector) VALUES (?, ?, ?, ?)",
            (filename, text, json.dumps(keywords), vector.tobytes())
        )
        self.conn.commit()
        print(f"✅ Ingested {filename} | Dense Keywords: {keywords}")

    def fuzzy_search(self, user_query, min_score=0.20, limit=3):
        query_vector = search_model.encode(user_query).astype(np.float32)
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT filename, dense_keywords, semantic_vector FROM documents")
        rows = cursor.fetchall()

        matches = []
        for filename, kw_json, vector_blob in rows:
            db_vector = np.frombuffer(vector_blob, dtype=np.float32)
            score = util.cos_sim(query_vector, db_vector).item()
            
            if score >= min_score:
                matches.append({
                    "filename": filename,
                    "keywords": json.loads(kw_json),
                    "fidelity_score": round(score, 4)
                })

        return sorted(matches, key=lambda x: x['fidelity_score'], reverse=True)[:limit]

# --- TEST DRIVE ---

if __name__ == "__main__":
    corpus = HistoricalDocCorpus(reset=True)

    docs = [
        ("civil_war_dispatch.txt", "The rapid movements of the cavalry unit were essential for the flanking maneuver during the 1864 campaign."),
        ("farming_treatise.txt", "A treatise on local agricultural practices, specifically focusing on crop rotation and soil alkalinity in the valley.")
    ]

    print("--- Ingesting with Word-Level De-duplication ---")
    for name, content in docs:
        corpus.ingest_document(name, content)

    print("\n--- Search Results ---")
    query = "horse soldiers" # query for us -> note how it's not 100%: bit more CHAT like
    results = corpus.fuzzy_search(query)

    for r in results:
        print(f"Match: {r['filename']} (Score: {r['fidelity_score']})")
        print(f"Keywords: {r['keywords']}")