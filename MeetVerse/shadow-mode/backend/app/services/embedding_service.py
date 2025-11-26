# app/services/embedding_service.py
import os
from typing import List

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").lower()

# OpenAI settings
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

# Gemini settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "models/text-embedding-004")

# Local fallback
LOCAL_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")

def get_openai():
    import openai
    openai.api_key = OPENAI_API_KEY
    return openai

def get_gemini():
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    return genai

async def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Returns embedding vectors using:
    - Gemini (primary, if configured)
    - OpenAI (optional)
    - Local sentence-transformers (fallback)
    """

    # 1️⃣ GEMINI EMBEDDINGS
    if EMBEDDING_PROVIDER == "gemini" and GEMINI_API_KEY:
        genai = get_gemini()
        model = genai.GenerativeModel(GEMINI_MODEL)

        vectors = []
        for text in texts:
            response = model.embed(text)
            vectors.append(response['embedding'])
        return vectors

    # 2️⃣ OPENAI EMBEDDINGS
    if EMBEDDING_PROVIDER == "openai" and OPENAI_API_KEY:
        openai = get_openai()
        resp = openai.Embedding.create(model=OPENAI_MODEL, input=texts)
        return [d["embedding"] for d in resp["data"]]

    # 3️⃣ LOCAL FALLBACK
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(LOCAL_MODEL)
    return model.encode(texts, convert_to_numpy=True).tolist()
