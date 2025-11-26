# app/embeddings.py

import google.generativeai as genai
import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY missing in environment variables")

genai.configure(api_key=GEMINI_API_KEY)

# Use Gemini embedding model
EMBED_MODEL = "models/text-embedding-004"

def embed_text(text: str) -> list:
    """
    Returns a vector embedding for any text using Gemini.
    """
    if not text:
        return [0.0] * 768  # fallback vector

    try:
        response = genai.embed_content(
            model=EMBED_MODEL,
            content=text,
            task_type="retrieval_document"
        )
        return response["embedding"]
    except Exception as e:
        print("Embedding error:", e)
        return [0.0] * 768
