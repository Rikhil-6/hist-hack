import json
import math
from google.cloud import storage
from keybert import KeyBERT

# External model initialization
kw_model = KeyBERT()

class CloudExactSearch:
    def __init__(self, bucket_name):
        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)

    def _get_keywords(self, text):
        """Extracts 1-gram keywords proportional to document length."""
        if not text or not text.strip(): return []
        word_count = len(text.split())
        target_n = max(3, min(20, math.ceil(word_count / 40)))
        try:
            candidates = kw_model.extract_keywords(
                text, keyphrase_ngram_range=(1, 1), stop_words='english', top_n=target_n
            )
            return [cand[0].lower() for cand in candidates]
        except:
            return text.split()[:3]

    def run_indexer(self, prefix="ocr_results/"):
        """Crawls GCS and updates metadata/sidecars."""
        blobs = self.client.list_blobs(self.bucket.name, prefix=prefix)
        for blob in blobs:
            if not blob.name.endswith(".txt"): continue
            
            print(f"Indexing: {blob.name}")
            text = blob.download_as_text()
            keywords = self._get_keywords(text)
            
            # Update GCS Custom Metadata for fast filtering
            blob.metadata = {"search_tags": " ".join(keywords[:5])}
            blob.patch()

            # Create sidecar JSON for detailed retrieval
            sidecar_path = blob.name.replace("ocr_results/", "metadata/").replace(".txt", ".json")
            sidecar_blob = self.bucket.blob(sidecar_path)
            sidecar_blob.upload_from_string(json.dumps({
                "file": blob.name, 
                "keywords": keywords
            }))

    def search(self, query):
        """Finds files using GCS metadata tags (Objective 2)."""
        query = query.lower()
        blobs = self.client.list_blobs(self.bucket.name, prefix="ocr_results/")
        results = []
        for blob in blobs:
            tags = blob.metadata.get("search_tags", "") if blob.metadata else ""
            if query in tags.split():
                results.append({"file": blob.name, "uri": f"gs://{self.bucket.name}/{blob.name}"})
        return results