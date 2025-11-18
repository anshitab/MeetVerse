"""
ChromaDB semantic memory for Shadow Agent
Stores transcripts + AI responses using vector embeddings
"""

import chromadb
from chromadb.config import Settings
import os
from datetime import datetime

from app.embeddings import embed_text


CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")
CHROMA_TENANT = os.getenv("CHROMA_TENANT")
CHROMA_DATABASE = os.getenv("CHROMA_DATABASE", "MeetVerse")

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")


def create_chroma_client():
    if CHROMA_API_KEY and CHROMA_TENANT:
        try:
            print("Connecting to Chroma Cloud...")
            return chromadb.HttpClient(
                host="api.trychroma.com",
                port=443,
                ssl=True,
                headers={
                    "x-chroma-token": CHROMA_API_KEY,
                    "x-chroma-tenant": CHROMA_TENANT,
                    "x-chroma-database": CHROMA_DATABASE,
                },
            )
        except Exception as e:
            print("Cloud connection failed:", e)
            print("Falling back to local Chroma")

    print("Using local ChromaDB PersistentClient")

    return chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False)
    )


client = create_chroma_client()


# ------------------------------------------------------------
# Collections
# ------------------------------------------------------------
transcripts = client.get_or_create_collection(
    name="meeting_transcripts",
    metadata={"hnsw:space": "cosine"}
)

ai_responses = client.get_or_create_collection(
    name="ai_responses",
    metadata={"hnsw:space": "cosine"}
)


# ------------------------------------------------------------
# TRANSCRIPT FUNCTIONS
# ------------------------------------------------------------
def add_transcript(meeting_id: str, text: str, transcript_id: str):
    embedding = embed_text(text)

    transcripts.add(
        ids=[f"transcript_{meeting_id}_{transcript_id}"],
        documents=[text],
        embeddings=[embedding],
        metadatas=[{
            "meeting_id": meeting_id,
            "transcript_id": transcript_id,
            "timestamp": datetime.utcnow().isoformat()
        }]
    )


def search_transcripts(query: str, meeting_id: str = None, n_results: int = 5):
    where = {"meeting_id": meeting_id} if meeting_id else None

    return transcripts.query(
        query_texts=[query],
        n_results=n_results,
        where=where
    )


def get_meeting_transcripts(meeting_id: str, limit: int = 20):
    result = transcripts.get(where={"meeting_id": meeting_id})

    if not result or not result.get("documents"):
        return []

    docs = result["documents"][:limit]
    metas = result["metadatas"][:limit]

    return [
        {
            "type": "transcript",
            "content": d,
            "metadata": m
        }
        for d, m in zip(docs, metas)
    ]


# ------------------------------------------------------------
# AI RESPONSE FUNCTIONS
# ------------------------------------------------------------
def add_ai_response(meeting_id: str, task_id: str, command: str, response: str):
    embedding = embed_text(response)

    ai_responses.add(
        ids=[f"ai_{meeting_id}_{task_id}"],
        documents=[response],
        embeddings=[embedding],
        metadatas=[{
            "meeting_id": meeting_id,
            "task_id": task_id,
            "command": command,
            "timestamp": datetime.utcnow().isoformat()
        }]
    )


def get_meeting_ai_responses(meeting_id: str, limit: int = 20):
    result = ai_responses.get(where={"meeting_id": meeting_id})

    if not result or not result.get("documents"):
        return []

    docs = result["documents"][:limit]
    metas = result["metadatas"][:limit]

    return [
        {
            "type": "ai_response",
            "content": d,
            "metadata": m
        }
        for d, m in zip(docs, metas)
    ]


def search_ai(query: str, meeting_id: str = None, n_results: int = 5):
    where = {"meeting_id": meeting_id} if meeting_id else None

    return ai_responses.query(
        query_texts=[query],
        n_results=n_results,
        where=where
    )


# ------------------------------------------------------------
# FULL MEETING CONTEXT
# ------------------------------------------------------------
def get_full_meeting_context(meeting_id: str, limit: int = 20):
    t = get_meeting_transcripts(meeting_id, limit)
    a = get_meeting_ai_responses(meeting_id, limit)

    combined = t + a

    combined.sort(
        key=lambda x: x["metadata"].get("timestamp", "")
    )

    return combined
