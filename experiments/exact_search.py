import sqlite3
import json
import math
from keybert import KeyBERT

# Initialize the keyword model (1-gram focus)
# This stays outside the class to avoid reloading on every instance
kw_model = KeyBERT()

class ExactKeywordCorpus:
    def __init__(self, db_path="exact_corpus.db", reset=False):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        if reset:
            self._reset_db()
        self._setup_db()

    def _setup_db(self):
        cursor = self.conn.cursor()
        # Main storage for the document text and the JSON keywords
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                ocr_text TEXT,
                keywords_json TEXT
            )
        ''')
        # FTS5 Virtual Table for high-speed exact matching
        # 'content' = the full text, 'keywords' = the extracted 1-grams
        cursor.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                content, 
                keywords,
                content_id UNINDEXED
            )
        ''')
        self.conn.commit()

    def _reset_db(self):
        cursor = self.conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS documents")
        cursor.execute("DROP TABLE IF EXISTS search_index")
        self.conn.commit()

    def _get_1gram_dense_keywords(self, text):
        """
        Extracts single-word keywords. Scale: 1 keyword per 40 words.
        """
        # Ensure text isn't empty to avoid division by zero
        if not text or not text.strip():
            return [], 0
            
        word_list = text.split()
        count = len(word_list)
        
        # Proportional scaling: min 3, max 20
        target_n = max(3, min(20, math.ceil(count / 40)))
        
        try:
            candidates = kw_model.extract_keywords(
                text, 
                keyphrase_ngram_range=(1, 1), 
                stop_words='english', 
                top_n=target_n
            )
            keywords = [cand[0].lower() for cand in candidates]
        except Exception:
            # Fallback for very short or noisy OCR text
            keywords = word_list[:3] if count > 0 else []
            
        return keywords, count

    def ingest_document(self, filename, text):
        """
        Processes the OCR text into the exact-match engine.
        """
        # Variables defined here before use
        keywords, word_count = self._get_1gram_dense_keywords(text)
        keyword_str = " ".join(keywords)
        
        cursor = self.conn.cursor()
        
        # 1. Permanent Storage
        cursor.execute(
            "INSERT INTO documents (filename, ocr_text, keywords_json) VALUES (?, ?, ?)",
            (filename, text, json.dumps(keywords))
        )
        doc_id = cursor.lastrowid
        
        # 2. Search Indexing (FTS5)
        cursor.execute(
            "INSERT INTO search_index (content, keywords, content_id) VALUES (?, ?, ?)",
            (text, keyword_str, doc_id)
        )
        
        self.conn.commit()
        print(f"✅ Indexed {filename} | {word_count} words -> {len(keywords)} 1-grams")

    def exact_search(self, query):
        """
        Finds exact matches in either the dense keywords or the full content.
        """
        cursor = self.conn.cursor()
        # FTS5 'MATCH' looks for exact tokens. Rank is BM25 relevance.
        cursor.execute('''
            SELECT d.filename, d.keywords_json, s.rank 
            FROM search_index s
            JOIN documents d ON s.content_id = d.id
            WHERE search_index MATCH ?
            ORDER BY rank
        ''', (query,))
        
        rows = cursor.fetchall()
        return [
            {
                "filename": r[0],
                "keywords": json.loads(r[1]),
                "score": round(r[2], 4) 
            } for r in rows
        ]

# --- QUICK TEST ---
if __name__ == "__main__":
    # Test with dummy data
    engine = ExactKeywordCorpus(reset=True)
    
    test_text = "The cavalry arrived at dawn. The flanking maneuver was a total success despite the mud."
    engine.ingest_document("dispatch_1864.txt", test_text)
    
    print("\n--- Exact Search Test ---")
    res = engine.exact_search("cavalry")
    for item in res:
        print(f"File: {item['filename']} | Keywords: {item['keywords']}")