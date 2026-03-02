# Hist Hack: CO 273 Pipeline

## Mission Overview

Hist Hack is a high-performance solution designed to process large volumes of historical documents. Through applying modern OCR techniques, re-indexing methods and advanced semantic analysis and summaries are possible. The pipeline is aimed at delivering a robust system for high-fidelity OCR, semantic retrieval, and historian-grade summaries of the processed documents.

---

## Functionalities

### Function 1: High-Fidelity OCR & Correction

Hist Hack ingests both user-uploaded images and batch-processed archival images from cloud storage, applies vision-language models with OCR context correction, and produces high-accuracy, machine-readable text. The system is designed to handle handwritten material, historical typography, and low-quality scans, outperforming legacy OCR systems in both fidelity and contextual accuracy.


### Function 2: The "Kratoska Link" (Re-indexing)

Hist Hack digitizes the scanned Kratoska Index and constructs an enriched, algorithmic keyword index linked to the CO 273 documents. This is supported by Google Cloud and our cloud pipeline, for efficient processing and storage handling. Users can search a **Kratoska keyword** (e.g., "Opium") and instantly navigate to the exact page(s) where it appears. The system not only validates keyword presence but also adds semantic links, descriptions, and contextual metadata, supporting historically accurate research and analysis.

### Function 3: The Semantic Historian (RAG & Summarization)

Hist Hack can generate historian-grade summaries of specified documents over the generated text corpus.

A chatbot interface where users can ask questions and receive grounded answers derived from the documents is still undergoing testing and refinement.

### Historical themes
- Colonialism, Race and Politics
- Gender and Sexuality


## Tech Stack

- **OCR Engine**: **Gemini 2.5 Flash** 
- **Semantic Search**: **Langchain** / **FAISS** / **Gemini 2.5 Pro**
- **Text Embeddings**: **Vertex AI** / **Sentence Transformers**  
- **Web Framework**: **FastAPI** (Uvicorn)  
- **Containerization**: **Docker**  (For Mac)
- **Version Control**: **Git** (GitHub for code sharing)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Rikhil-6/hist-hack/tree/main
cd hist-hack
```

### 2. Running the Project


**Add your .env credentials**
- GOOGLE_API_KEY
- GOOGLE_APPLICATION_CREDENTIALS
- GOOGLE_CLOUD_PROJECT


**Enable Google Cloud API**

**Run using terminal commands**

For Windows
```bash
.venv\Scripts\activate
run.bat
```

For Linux
```bash
.venv\Scripts\activate
run.sh
```

For Mac (still under testing and refinement)
```bash
docker compose up --build
```