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

class Document(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    title: str
    content: str
    doc_type: str = "text"   # text / code / summary / instructions
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        from_attributes = True
