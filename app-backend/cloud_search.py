import json
import math
import os
import argparse
from google.cloud import storage
from keybert import KeyBERT

# Initialize KeyBERT (This takes a moment to load the model)
kw_model = KeyBERT()

class CloudExactSearch:
    def __init__(self, bucket_name):
        self.storage_client = storage.Client(project='project-3f441d35-164a-4a8d-b3a') 
        # cfg project ID in env var mb
        self.bucket_name = bucket_name
        self.bucket = self.storage_client.bucket(bucket_name)

    def _get_1gram_keywords(self, text):
        if not text or not text.strip(): return []
        word_count = len(text.split())
        # Dynamic keyword count based on document length
        target_n = max(3, min(20, math.ceil(word_count / 40)))
        try:
            candidates = kw_model.extract_keywords(
                text, keyphrase_ngram_range=(1, 1), stop_words='english', top_n=target_n
            )
            return [cand[0].lower() for cand in candidates]
        except Exception:
            return text.split()[:3]

    def index_files(self, prefix="ocr_results/", incremental=True):
        """
        Crawls ocr_results. 
        If incremental=True, it skips files that already have a .json sidecar in metadata/
        """
        blobs = list(self.storage_client.list_blobs(self.bucket_name, prefix=prefix))
        
        print(f"--- Starting Indexing (Incremental: {incremental}) ---")
        
        for blob in blobs:
            if not blob.name.endswith(".txt"): continue
            
            # Define the sidecar path
            sidecar_path = blob.name.replace("ocr_results/", "metadata/").replace(".txt", ".json")
            sidecar_blob = self.bucket.blob(sidecar_path)

            # INCREMENTAL CHECK: Skip if metadata already exists
            if incremental and sidecar_blob.exists():
                # print(f"Skipping (Already Indexed): {blob.name}")
                continue

            print(f"Indexing: {blob.name}")
            try:
                text = blob.download_as_text()
                keywords = self._get_1gram_keywords(text)
                
                # 1. Update Blob Metadata (for fast filtering)
                blob.metadata = {"search_keywords": " ".join(keywords[:5])} # Store top 5 in metadata
                blob.patch()

                # 2. Create Sidecar JSON (for detailed storage)
                sidecar_data = {
                    "filename": blob.name,
                    "all_keywords": keywords,
                    "word_count": len(text.split())
                }
                sidecar_blob.upload_from_string(
                    data=json.dumps(sidecar_data),
                    content_type='application/json'
                )
                print(f"✅ Created sidecar: {sidecar_path}")
            except Exception as e:
                print(f"❌ Error processing {blob.name}: {e}")

    def exact_search(self, query_keyword):
        """Search via metadata tags for high performance."""
        query_keyword = query_keyword.lower()
        blobs = self.storage_client.list_blobs(self.bucket_name, prefix="ocr_results/")
        results = []

        print(f"--- Searching for: '{query_keyword}' ---")
        for b in blobs:
            # We must get the blob object to see metadata
            blob = self.bucket.get_blob(b.name)
            
            if blob and blob.metadata:
                tags = blob.metadata.get("search_keywords", "")
                if query_keyword in tags.split():
                    # Link to the sidecar for more detail if needed
                    results.append({
                        "filename": blob.name,
                        "gcs_uri": f"gs://{self.bucket_name}/{blob.name}",
                        "tags": tags
                    })
        return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GCS Document Indexer and Searcher")
    parser.add_argument("mode", choices=["index", "search"], help="Mode: index new files or search existing")
    parser.add_argument("--query", type=str, help="The keyword to search for (required in search mode)")
    parser.add_argument("--all", action="store_false", dest="incremental", help="Force re-indexing of all files")
    parser.set_defaults(incremental=True)

    args = parser.parse_args()
    
    engine = CloudExactSearch(bucket_name="hist-hack-bucket2")

    if args.mode == "index":
        engine.index_files(incremental=args.incremental)
    
    elif args.mode == "search":
        if not args.query:
            print("Error: Please provide a --query keyword.")
        else:
            res = engine.exact_search(args.query)
            if not res:
                print("No matches found.")
            for item in res:
                print(f"Match Found: {item['filename']} (Tags: {item['tags']})")