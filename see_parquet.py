import io
import os
import pandas as pd
from google.cloud import storage
from pathlib import Path
from dotenv import load_dotenv

# 1. Load credentials (matches your main.py logic)
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

BUCKET_NAME = "hist-hack-bucket2"
BLOB_PATH = "indexes/vector_index.parquet"

def inspect_gcs_parquet():
    print(f"--- Connecting to GCS Bucket: {BUCKET_NAME} ---")
    
    try:
        # Initialize Client
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(BLOB_PATH)

        if not blob.exists():
            print(f"ERROR: Blob {BLOB_PATH} not found in bucket!")
            return

        # Download to memory
        print(f"Downloading {BLOB_PATH}...")
        data = blob.download_as_bytes()
        
        # Load with Pandas
        df = pd.read_parquet(io.BytesIO(data))

        print("\n" + "="*50)
        print("📊 PARQUET FILE STRUCTURE")
        print("="*50)
        
        print(f"\n[Total Rows]: {len(df)}")
        
        print("\n[Columns & Types]:")
        for col, dtype in df.dtypes.items():
            print(f" - {col:15} | {dtype}")

        print("\n[First 3 Rows Preview]:")
        # Displaying first 3 rows in a readable format
        pd.set_option('display.max_columns', None)
        pd.set_option('display.width', 1000)
        print(df.head(3))

        print("\n[Keywords Format Check]:")
        first_val = df['keywords'].iloc[0] if 'keywords' in df.columns else "N/A"
        print(f"Type of 'keywords' entry: {type(first_val)}")
        print(f"Content: {first_val}")
        
        print("\n" + "="*50)

    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    inspect_gcs_parquet()