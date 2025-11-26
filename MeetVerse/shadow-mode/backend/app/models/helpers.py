from motor.motor_asyncio import AsyncIOMotorCollection

async def get_all(collection: AsyncIOMotorCollection):
    return await collection.find().to_list(1000)

async def get_by_id(collection: AsyncIOMotorCollection, id: str):
    return await collection.find_one({"_id": id})

async def create(collection: AsyncIOMotorCollection, data: dict):
    result = await collection.insert_one(data)
    return {"_id": str(result.inserted_id), **data}

async def update(collection: AsyncIOMotorCollection, id: str, data: dict):
    await collection.update_one({"_id": id}, {"$set": data})
    return await get_by_id(collection, id)

async def delete(collection: AsyncIOMotorCollection, id: str):
    await collection.delete_one({"_id": id})
    return {"status": "deleted"}
