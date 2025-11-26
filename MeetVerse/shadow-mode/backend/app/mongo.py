# app/mongo.py
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "shadow_intern")

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[MONGO_DB]

# Collections (names)
tasks_collection = db["tasks"]
documents_collection = db["documents"]
transcripts_collection = db["transcripts"]
metadata_collection = db["metadata"]  # optional
