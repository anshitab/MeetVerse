# app/chroma_client.py
import chroma_db
from chromadb.config import Settings
import os

CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")
CHROMA_TENANT = os.getenv("CHROMA_TENANT")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")

if CHROMA_API_KEY and CHROMA_TENANT:
    try:
        client = chroma_db.HttpClient(
            host="api.chroma.com",
            port=443,
            ssl=True,
            headers={
                "X-Chroma-Token": CHROMA_API_KEY,
                "X-Chroma-Tenant": CHROMA_TENANT
            }
        )
    except Exception:
        client = chroma_db.PersistentClient(path=CHROMA_PERSIST_DIR, settings=Settings(anonymized_telemetry=False))
else:
    client = chroma_db.PersistentClient(path=CHROMA_PERSIST_DIR, settings=Settings(anonymized_telemetry=False))

collection = client.get_or_create_collection(name="meeting_memory", metadata={"hnsw:space": "cosine"})
