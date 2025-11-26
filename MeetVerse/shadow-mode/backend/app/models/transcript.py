from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
import datetime

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        return str(v)

class Transcript(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    text: str
    speaker: Optional[str] = "user"  # user / ai
    metadata: Optional[dict] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        from_attributes = True
