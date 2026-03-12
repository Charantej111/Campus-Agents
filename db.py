import os
from typing import List, Optional, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from dotenv import load_dotenv
from bson.objectid import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "campus_agent_db"
COLLECTION_NAME = "generations"

client = None
db = None

def get_database():
    global client, db
    if client is None:
        try:
            print(f"Connecting to MongoDB at {MONGODB_URI}")
            client = AsyncIOMotorClient(MONGODB_URI)
            db = client[DB_NAME]
            print("Connected to MongoDB successfully.")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            raise e
    return db

async def save_generation_to_db(data: dict):
    """Saves a generated interview plan to the database."""
    database = get_database()
    if database is None:
        raise RuntimeError("Database connection failed")
    collection = database[COLLECTION_NAME]
    
    document = {
        **data,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await collection.insert_one(document)
    print(f"Saved generation with ID: {result.inserted_id}")
    return str(result.inserted_id)

async def get_generation_history(limit: int = 10):
    """Retrieves recent generation history."""
    database = get_database()
    if database is None:
        raise RuntimeError("Database connection failed")
    collection = database[COLLECTION_NAME]
    
    cursor = collection.find({}).sort("created_at", -1).limit(limit)
    
    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
        history.append(doc)
        
    return history

# --- Exam Agent DB Helpers ---

async def get_all_students(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.students.find({"workspace_id": workspace_id})
    students = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Ensure default values are filled for old mock data
        if "program_id" not in doc:
            doc["program_id"] = "Unknown"
        if "semester" not in doc:
            doc["semester"] = 1
        if "batch_year" not in doc:
            doc["batch_year"] = datetime.now(timezone.utc).year
        students.append(doc)
    return students

async def get_all_rooms(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.rooms.find({"workspace_id": workspace_id})
    rooms = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        rooms.append(doc)
    return rooms

async def get_all_buildings(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.buildings.find({"workspace_id": workspace_id})
    buildings = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        buildings.append(doc)
    return buildings

async def get_all_departments(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.departments.find({"workspace_id": workspace_id})
    depts = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        depts.append(doc)
    return depts

async def get_all_degrees(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.degrees.find({"workspace_id": workspace_id})
    degrees = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        degrees.append(doc)
    return degrees

async def create_building(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.buildings.insert_one(data)
    return str(result.inserted_id)

async def create_room(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.rooms.insert_one(data)
    return str(result.inserted_id)

async def create_department(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.departments.insert_one(data)
    return str(result.inserted_id)

async def create_degree(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.degrees.insert_one(data)
    return str(result.inserted_id)

async def create_student(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.students.insert_one(data)
    return str(result.inserted_id)

async def get_rooms_by_building(workspace_id: str, building_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.rooms.find({"workspace_id": workspace_id, "building_id": building_id})
    rooms = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        rooms.append(doc)
    return rooms

async def create_exam_cycle(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.exam_cycles.insert_one(data)
    return str(result.inserted_id)

async def get_all_exam_cycles(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.exam_cycles.find({"workspace_id": workspace_id})
    cycles = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        cycles.append(doc)
    return cycles

async def create_calendar_event(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.calendar_events.insert_one(data)
    return str(result.inserted_id)

async def get_calendar_events(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.calendar_events.find({"workspace_id": workspace_id})
    events = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        events.append(doc)
        
    # Generate dynamic holidays (Sundays and Jan 1st for +/- 3 years)
    current_year = datetime.now(timezone.utc).year
    dynamic_events = []
    
    for year in range(current_year - 3, current_year + 4):
        # Add Jan 1st
        dynamic_events.append({
            "_id": f"new_year_{year}",
            "title": "New Year's Day",
            "date": f"{year}-01-01",
            "type": "holiday",
            "workspace_id": workspace_id,
        })
        # Add all Sundays
        from datetime import date, timedelta as td
        d = date(year, 1, 1)
        d += td(days=6 - d.weekday()) # First Sunday
        while d.year == year:
            dynamic_events.append({
                "_id": f"sunday_{d.isoformat()}",
                "title": "Sunday",
                "date": d.isoformat(),
                "type": "holiday",
                "workspace_id": workspace_id,
            })
            d += td(days=7)
            
    return events + dynamic_events

# Course is effectively represented by "exam" data in the current seed but let's separate if needed.
# For now, "Course" == "Subject" often. Let's assume we manage "Courses" metadata separately.
async def create_course(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.courses.insert_one(data)
    return str(result.inserted_id)

async def get_all_courses(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.courses.find({"workspace_id": workspace_id})
    courses = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        courses.append(doc)
    return courses

async def create_program(data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.programs.insert_one(data)
    return str(result.inserted_id)

async def get_all_programs(workspace_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    cursor = db.programs.find({"workspace_id": workspace_id})
    programs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        programs.append(doc)
    return programs

# --- User & Workspace DB Operations ---

async def create_user(user_data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    # Check if exists
    existing = await db.users.find_one({"email": user_data["email"]})
    if existing:
        raise ValueError("User with this email already exists")
        
    result = await db.users.insert_one(user_data)
    return str(result.inserted_id)

async def get_user_by_email(email: str) -> Optional[dict]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    user = await db.users.find_one({"email": email})
    if user:
        user["_id"] = str(user["_id"])
    return user

async def create_workspace(workspace_data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.workspaces.insert_one(workspace_data)
    return str(result.inserted_id)

async def get_workspaces_for_user(user_id: str) -> List[dict]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    # Find workspaces where user is owner OR member
    cursor = db.workspaces.find({
        "$or": [
            {"owner_id": user_id},
            {"members": user_id}
        ]
    })
    workspaces = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        workspaces.append(doc)
    return workspaces

async def get_workspace_by_id(workspace_id: str) -> Optional[dict]:
    db = get_database()
    from bson.objectid import ObjectId
    try:
        if db is None:
            raise RuntimeError("Database connection failed")
        ws = await db.workspaces.find_one({"_id": ObjectId(workspace_id)})
        if ws:
            ws["_id"] = str(ws["_id"])
        return ws
    except:
        return None

async def add_member_to_workspace(workspace_id: str, user_id: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    from bson.objectid import ObjectId
    await db.workspaces.update_one(
        {"_id": ObjectId(workspace_id)},
        {"$addToSet": {"members": user_id}}
    )

# --- Invitation Operations ---

async def create_invitation(invite_data: dict) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db.invitations.insert_one(invite_data)
    return str(result.inserted_id)

async def get_invitation_by_token(token: str) -> Optional[dict]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    invite = await db.invitations.find_one({"token": token})
    if invite:
        invite["_id"] = str(invite["_id"])
    return invite

async def update_invitation_status(token: str, status: str):
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    await db.invitations.update_one(
        {"token": token},
        {"$set": {"status": status}}
    )

async def delete_document(collection_name: str, doc_id: str, workspace_id: str) -> bool:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    from bson.objectid import ObjectId
    # Support deletion by either ObjectId-based _id or by custom string `id` field
    try:
        query = {"_id": ObjectId(doc_id), "workspace_id": workspace_id}
    except Exception:
        query = {"id": doc_id, "workspace_id": workspace_id}

    result = await db[collection_name].delete_one(query)
    return result.deleted_count > 0

async def delete_all_documents(collection_name: str, workspace_id: str) -> bool:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    result = await db[collection_name].delete_many({"workspace_id": workspace_id})
    return result.deleted_count > 0

async def update_document(collection_name: str, doc_id: str, data: dict, workspace_id: str) -> bool:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    from bson.objectid import ObjectId
    # Ensure workspace match
    if "workspace_id" in data and data["workspace_id"] != workspace_id:
         raise ValueError("Cannot move document to another workspace")
         
    # Remove _id from data if present
    if "_id" in data: del data["_id"]
    # Support update by either ObjectId _id or by custom string `id` field
    try:
        filter_q = {"_id": ObjectId(doc_id), "workspace_id": workspace_id}
    except Exception:
        filter_q = {"id": doc_id, "workspace_id": workspace_id}

    result = await db[collection_name].update_one(filter_q, {"$set": data})
    return result.modified_count > 0 or result.matched_count > 0

async def update_workspace(workspace_id: str, data: dict) -> bool:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    from bson.objectid import ObjectId
    if "_id" in data: del data["_id"]
    result = await db.workspaces.update_one({"_id": ObjectId(workspace_id)}, {"$set": data})
    return result.modified_count > 0 or result.matched_count > 0

async def delete_workspace(workspace_id: str, user_id: str) -> bool:
    db = get_database()
    if db is None:
        raise RuntimeError("Database connection failed")
    from bson.objectid import ObjectId
    # Only owner can delete
    result = await db.workspaces.delete_one({"_id": ObjectId(workspace_id), "owner_id": user_id})
    return result.deleted_count > 0

# --- Exam Plan Persistence ---

async def save_exam_plan(workspace_id: str, plan_data: dict) -> str:
    db = get_database()
    if db is None:
         raise RuntimeError("Database connection failed")
    
    document = {
        **plan_data,
        "workspace_id": workspace_id,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.exam_plans.insert_one(document)
    return str(result.inserted_id)

async def get_latest_exam_plan(workspace_id: str) -> Optional[dict]:
    db = get_database()
    if db is None:
         raise RuntimeError("Database connection failed")
    
    # Get the most recent plan
    plan = await db.exam_plans.find_one(
        {"workspace_id": workspace_id},
        sort=[("created_at", -1)] # Descending
    )
    if plan:
        plan["_id"] = str(plan["_id"])
    return plan
