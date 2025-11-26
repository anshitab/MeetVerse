from typing import Optional, List, Dict, Any
from app.mongo import (
    documents_collection,
    transcripts_collection
)
from app.chroma_db.chroma_db import (
    collection,
    add_vector,
    search_vectors,
    get_vectors
)
from app.services.embedding_service import embed_texts
import datetime
import uuid


async def add_document(
    title: str,
    content: str,
    doc_type: str = "text",
    metadata: Optional[dict] = None
) -> Dict[str, Any]:
    now = datetime.datetime.utcnow()

    doc = {
        "title": title,
        "content": content,
        "doc_type": doc_type,
        "metadata": metadata or {},
        "created_at": now,
        "updated_at": now
    }

    result = await documents_collection.insert_one(doc)
    mongo_id = str(result.inserted_id)
    chroma_id = f"doc_{mongo_id}"

    vectors = await embed_texts([content])

    add_vector(
        doc_id=chroma_id,
        text=content,
        embedding=vectors[0],
        metadata={
            "mongo_id": mongo_id,
            "doc_type": doc_type,
            **(metadata or {})
        }
    )

    return {
        "mongo_id": mongo_id,
        "chroma_id": chroma_id
    }


async def add_transcript(
    meeting_id: str,
    text: str,
    speaker: Optional[str] = "user",
    metadata: Optional[dict] = None
) -> Dict[str, Any]:
    now = datetime.datetime.utcnow()

    transcript = {
        "meeting_id": meeting_id,
        "text": text,
        "speaker": speaker,
        "metadata": metadata or {},
        "created_at": now
    }

    result = await transcripts_collection.insert_one(transcript)
    mongo_id = str(result.inserted_id)
    chroma_id = f"transcript_{mongo_id}"

    vectors = await embed_texts([text])

    add_vector(
        doc_id=chroma_id,
        text=text,
        embedding=vectors[0],
        metadata={
            "mongo_id": mongo_id,
            "meeting_id": meeting_id,
            "speaker": speaker,
            **(metadata or {})
        }
    )

    return {
        "mongo_id": mongo_id,
        "chroma_id": chroma_id
    }


async def semantic_search(
    query: str,
    meeting_id: Optional[str] = None,
    n_results: int = 5
) -> Dict[str, Any]:

    where = {"meeting_id": meeting_id} if meeting_id else None

    try:
        results = search_vectors(
            query=query,
            n_results=n_results,
            where=where
        )
        return results
    except Exception as e:
        return {
            "error": str(e),
            "results": []
        }


async def get_meeting_context(
    meeting_id: str,
    limit: int = 20
) -> Dict[str, Any]:

    try:
        records = get_vectors(
            where={"meeting_id": meeting_id},
            limit=limit
        )

        docs = records.get("documents", []) if records else []
        return {
            "meeting_id": meeting_id,
            "documents": docs
        }
    except Exception as e:
        return {
            "error": str(e),
            "meeting_id": meeting_id,
            "documents": []
        }
