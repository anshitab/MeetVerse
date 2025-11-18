import os
import google.generativeai as genai

# Configure Gemini with API Key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ✔ VALID Gemini embedding model
GEMINI_EMBED_MODEL = "models/text-embedding-004"


def embed_text(text: str):
    """
    Generate an embedding using Gemini.
    Always returns a valid non-empty list to prevent Chroma crashes.
    """

    # Empty / None safety
    if not text or text.strip() == "":
        return [0.0] * 768  # fallback vector (Chroma requires non-empty embedding)

    try:
        response = genai.embed_content(
            model=GEMINI_EMBED_MODEL,
            content=text,
        )
        embedding = response.get("embedding")

        # Safety check: ensure embedding is valid
        if not embedding or len(embedding) == 0:
            print("⚠️ Gemini returned empty embedding. Using fallback.")
            return [0.0] * 768

        return embedding

    except Exception as e:
        print("❌ Gemini embedding error:", e)
        # Final fallback to avoid CRASH
        return [0.0] * 768
