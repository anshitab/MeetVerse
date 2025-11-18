"""
ChromaDB client for vector storage and retrieval
"""
import chromadb
from chromadb.config import Settings
import os

CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")
CHROMA_TENANT = os.getenv("CHROMA_TENANT")
CHROMA_DATABASE = os.getenv("CHROMA_DATABASE", "MeetVerse")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")

# Use ChromaDB Cloud if credentials are provided, otherwise use local
if CHROMA_API_KEY and CHROMA_TENANT:
    try:
        client = chromadb.HttpClient(
            host="api.trychroma.com",
            port=443,
            ssl=True,
            headers={
                "X-Chroma-Token": CHROMA_API_KEY,
                "X-Chroma-Tenant": CHROMA_TENANT
            }
        )
        # Set the database
        try:
            client.set_database(CHROMA_DATABASE)
        except Exception as e:
            print(f"Warning: Could not set database {CHROMA_DATABASE}: {e}")
            # Continue anyway, will use default database
    except Exception as e:
        print(f"Error connecting to ChromaDB Cloud: {e}")
        print("Falling back to local ChromaDB")
        client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False)
        )
else:
    # Fallback to local persistent client
    client = chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False)
    )

# Get or create collection for meeting transcripts
try:
    collection = client.get_or_create_collection(
        name="meeting_transcripts",
        metadata={"hnsw:space": "cosine"}
    )
except Exception as e:
    print(f"Error creating collection: {e}")
    # Try without metadata
    collection = client.get_or_create_collection(
        name="meeting_transcripts"
    )

def add_transcript(meeting_id: str, content: str, transcript_id: int):
    """Add transcript with embedding to ChromaDB"""
    collection.add(
        documents=[content],
        ids=[f"transcript_{transcript_id}"],
        metadatas=[{"meeting_id": meeting_id, "transcript_id": transcript_id}]
    )

def search_transcripts(query: str, meeting_id: str = None, n_results: int = 5):
    """Search transcripts by semantic similarity"""
    where = {"meeting_id": meeting_id} if meeting_id else None
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where
    )
    return results

def get_meeting_context(meeting_id: str, limit: int = 10):
    """Get all transcripts for a meeting"""
    results = collection.get(
        where={"meeting_id": meeting_id},
        limit=limit
    )
    return results

