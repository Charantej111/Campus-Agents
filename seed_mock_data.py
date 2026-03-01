import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "campus_agent_db"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_data():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    # Create demo user
    demo_email = "demo@campus.com"
    existing_user = await db.users.find_one({"email": demo_email})
    
    if existing_user:
        user_id = str(existing_user["_id"])
        print(f"Demo user already exists: {user_id}")
    else:
        user_result = await db.users.insert_one({
            "email": demo_email,
            "full_name": "Demo User",
            "password_hash": pwd_context.hash("password")
        })
        user_id = str(user_result.inserted_id)
        print(f"Created demo user: {user_id}")
    
    # Create workspace
    existing_workspace = await db.workspaces.find_one({"owner_id": user_id})
    
    if existing_workspace:
        workspace_id = str(existing_workspace["_id"])
        print(f"Workspace already exists: {workspace_id}")
    else:
        workspace_result = await db.workspaces.insert_one({
            "name": "Demo Campus",
            "owner_id": user_id,
            "members": [user_id]
        })
        workspace_id = str(workspace_result.inserted_id)
        print(f"Created workspace: {workspace_id}")
    
    # Clear existing data for this workspace
    await db.degrees.delete_many({"workspace_id": workspace_id})
    await db.programs.delete_many({"workspace_id": workspace_id})
    await db.departments.delete_many({"workspace_id": workspace_id})
    await db.buildings.delete_many({"workspace_id": workspace_id})
    await db.rooms.delete_many({"workspace_id": workspace_id})
    await db.courses.delete_many({"workspace_id": workspace_id})
    await db.exam_cycles.delete_many({"workspace_id": workspace_id})
    await db.students.delete_many({"workspace_id": workspace_id})
    
    # Degrees
    degrees_data = [
        {"name": "B.Tech", "workspace_id": workspace_id},
        {"name": "M.Tech", "workspace_id": workspace_id},
        {"name": "MCA", "workspace_id": workspace_id},
        {"name": "MBA", "workspace_id": workspace_id}
    ]
    degree_results = await db.degrees.insert_many(degrees_data)
    # Map name to ID for later use
    cursor = db.degrees.find({"workspace_id": workspace_id})
    degree_map = {doc["name"]: str(doc["_id"]) async for doc in cursor}
    print(f"Created {len(degrees_data)} degrees")

    # Departments
    departments_data = [
        {"id": "CSE", "name": "Computer Science and Engineering", "workspace_id": workspace_id},
        {"id": "AIML", "name": "Artificial Intelligence and Machine Learning", "workspace_id": workspace_id},
        {"id": "ECE", "name": "Electronics and Communication Engineering", "workspace_id": workspace_id},
        {"id": "ME", "name": "Mechanical Engineering", "workspace_id": workspace_id},
        {"id": "IT", "name": "Information Technology", "workspace_id": workspace_id},
        {"id": "MBA", "name": "Management Studies", "workspace_id": workspace_id}
    ]
    await db.departments.insert_many(departments_data)
    print(f"Created {len(departments_data)} departments")
    
    # Programs
    programs = [
        {"name": "B.Tech in Computer Science Engineering", "degree_id": degree_map["B.Tech"], "department_id": "CSE", "workspace_id": workspace_id},
        {"name": "M.Tech in Computer Science Engineering", "degree_id": degree_map["M.Tech"], "department_id": "CSE", "workspace_id": workspace_id},
        {"name": "B.Tech in Artificial Intelligence and Machine Learning", "degree_id": degree_map["B.Tech"], "department_id": "AIML", "workspace_id": workspace_id},
        {"name": "B.Tech in Electronics and Communication Engineering", "degree_id": degree_map["B.Tech"], "department_id": "ECE", "workspace_id": workspace_id},
        {"name": "B.Tech in Information Technology", "degree_id": degree_map["B.Tech"], "department_id": "IT", "workspace_id": workspace_id},
        {"name": "MBA in Management Studies", "degree_id": degree_map["MBA"], "department_id": "MBA", "workspace_id": workspace_id},
        {"name": "MCA in Information Technology", "degree_id": degree_map["MCA"], "department_id": "IT", "workspace_id": workspace_id}
    ]
    program_results = await db.programs.insert_many(programs)
    # Map name to ID for later use
    cursor = db.programs.find({"workspace_id": workspace_id})
    program_map = {doc["name"]: str(doc["_id"]) async for doc in cursor}
    print(f"Created {len(programs)} programs")
    
    # Buildings
    buildings = [
        {"id": "AB", "name": "Academic Block A", "workspace_id": workspace_id},
        {"id": "BB", "name": "Academic Block B", "workspace_id": workspace_id},
        {"id": "LH", "name": "Lecture Room Complex", "workspace_id": workspace_id}
    ]
    await db.buildings.insert_many(buildings)
    print(f"Created {len(buildings)} buildings")
    
    # Rooms
    rooms = [
        {"id": "101", "name": "Room 101", "capacity": 60, "rows": 10, "columns": 6, "building_id": "AB", "workspace_id": workspace_id},
        {"id": "102", "name": "Room 102", "capacity": 60, "rows": 10, "columns": 6, "building_id": "AB", "workspace_id": workspace_id},
        {"id": "201", "name": "Room 201", "capacity": 80, "rows": 10, "columns": 8, "building_id": "AB", "workspace_id": workspace_id},
        {"id": "101", "name": "Room 101", "capacity": 100, "rows": 10, "columns": 10, "building_id": "BB", "workspace_id": workspace_id},
        {"id": "102", "name": "Room 102", "capacity": 100, "rows": 10, "columns": 10, "building_id": "BB", "workspace_id": workspace_id},
        {"id": "301", "name": "Auditorium", "capacity": 200, "rows": 20, "columns": 10, "building_id": "LH", "workspace_id": workspace_id}
    ]
    await db.rooms.insert_many(rooms)
    print(f"Created {len(rooms)} rooms")
    
    # Courses
    courses = [
        # B.Tech CSE & IT (Semester 1)
        {"code": "CS101", "name": "Introduction to Programming", "semester": 1, "program_ids": [program_map["B.Tech in Computer Science Engineering"], program_map["B.Tech in Information Technology"]], "batch_ids": [2025, 2026], "department_id": "CSE", "workspace_id": workspace_id},
        {"code": "MA101", "name": "Engineering Mathematics I", "semester": 1, "program_ids": [program_map["B.Tech in Computer Science Engineering"], program_map["B.Tech in Information Technology"]], "batch_ids": [2025], "department_id": "CSE", "workspace_id": workspace_id},
        {"code": "PH101", "name": "Engineering Physics", "semester": 1, "program_ids": [program_map["B.Tech in Computer Science Engineering"], program_map["B.Tech in Information Technology"]], "batch_ids": [2025], "department_id": "CSE", "workspace_id": workspace_id},
        {"code": "EE101", "name": "Basic Electrical Engineering", "semester": 1, "program_ids": [program_map["B.Tech in Computer Science Engineering"], program_map["B.Tech in Information Technology"]], "batch_ids": [2025], "department_id": "ECE", "workspace_id": workspace_id},
        {"code": "CS201", "name": "Data Structures and Algorithms", "semester": 2, "program_ids": [program_map["B.Tech in Computer Science Engineering"]], "batch_ids": [2025, 2026], "department_id": "CSE", "workspace_id": workspace_id},
        
        # B.Tech AIML
        {"code": "AI101", "name": "Introduction to AI", "semester": 1, "program_ids": [program_map["B.Tech in Artificial Intelligence and Machine Learning"]], "batch_ids": [2025, 2026], "department_id": "AIML", "workspace_id": workspace_id},
        
        # M.Tech
        {"code": "MT501", "name": "Advanced Algorithms", "semester": 1, "program_ids": [program_map["M.Tech in Computer Science Engineering"]], "batch_ids": [2024, 2025], "department_id": "CSE", "workspace_id": workspace_id},
    ]
    await db.courses.insert_many(courses)
    print(f"Created {len(courses)} courses")
    
    # Exam Cycles
    exam_cycles = [
        {"name": "Midterms 2025", "semester": 1, "program_ids": [program_map["B.Tech in Computer Science Engineering"]], "batch_year": 2025, "student_ids": ["BT21CSE001"], "workspace_id": workspace_id},
        {"name": "Finals 2024", "semester": 2, "program_ids": [program_map["M.Tech in Computer Science Engineering"]], "batch_year": 2024, "student_ids": ["MT22CSE001"], "workspace_id": workspace_id},
    ]
    await db.exam_cycles.insert_many(exam_cycles)
    print(f"Created {len(exam_cycles)} exam cycles")
    
    # Students
    students = [
        {"id": "BT21CSE001", "name": "Rahul Sharma", "semester": 1, "program_id": program_map["B.Tech in Computer Science Engineering"], "batch_year": 2025, "enrolled_courses": ["CS101", "CS201", "AI101"], "workspace_id": workspace_id},
        {"id": "MT22CSE001", "name": "Deepak Joshi", "semester": 2, "program_id": program_map["M.Tech in Computer Science Engineering"], "batch_year": 2024, "enrolled_courses": ["MT501"], "workspace_id": workspace_id},
    ]

    import random
    first_names = ["Amit", "Sneha", "Karan", "Pooja", "Vikram", "Anjali", "Rohan", "Neha", "Sanjay", "Kavya", "Arjun", "Riya", "Aditya", "Ishita", "Siddharth", "Aisha"]
    last_names = ["Kumar", "Singh", "Patel", "Sharma", "Gupta", "Verma", "Reddy", "Rao", "Nair", "Das"]
    programs_list = [
        (program_map["B.Tech in Computer Science Engineering"], "BT", "CSE", [1, 2], [2024, 2025, 2026], ["CS101", "CS201"]),
        (program_map["B.Tech in Artificial Intelligence and Machine Learning"], "BT", "AIM", [1], [2025, 2026], ["AI101", "CS101"]),
        (program_map["M.Tech in Computer Science Engineering"], "MT", "CSE", [1, 2], [2024, 2025], ["MT501"]),
    ]

    for i in range(2, 32):
        prog_id, prefix, dept, sems, batches, possible_courses = random.choice(programs_list)
        batch = random.choice(batches)
        sem = random.choice(sems)
        courses = random.sample(possible_courses, k=random.randint(1, len(possible_courses)))
        
        student = {
            "id": f"{prefix}{batch % 100}{dept}{i:03d}",
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "semester": sem,
            "program_id": prog_id,
            "batch_year": batch,
            "enrolled_courses": courses,
            "workspace_id": workspace_id
        }
        students.append(student)

    # 10 exactly for B.Tech in CSE (Batch 2025, Semester 1)
    cse_prog_id = program_map["B.Tech in Computer Science Engineering"]
    for i in range(100, 110):
        students.append({
            "id": f"BT25CSE{i:03d}",
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "semester": 1,
            "program_id": cse_prog_id,
            "batch_year": 2025,
            "enrolled_courses": ["CS101", "MA101", "PH101", "EE101"],
            "workspace_id": workspace_id
        })
        
    # 10 exactly for B.Tech in IT (Batch 2025, Semester 1)
    it_prog_id = program_map["B.Tech in Information Technology"]
    for i in range(100, 110):
        students.append({
            "id": f"BT25IT{i:03d}",
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "semester": 1,
            "program_id": it_prog_id,
            "batch_year": 2025,
            "enrolled_courses": ["CS101", "MA101", "PH101", "EE101"],
            "workspace_id": workspace_id
        })

    await db.students.insert_many(students)
    print(f"Created {len(students)} students")
    
    print("\n✅ Mock data seeded successfully!")
    print(f"Login with: demo@campus.com / password")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
