from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
import datetime

# BSON to string converter
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        return str(v)

class Task(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    title: str
    description: Optional[str] = None
    status: str = "pending"   # pending / in-progress / completed
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        from_attributes = True
