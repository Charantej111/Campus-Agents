import asyncio
import os
import sys

# specific to allow importing from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_database, create_user, create_workspace
from exam_agent.models import Building, Department, Room, Student, User, Workspace
from auth_utils import get_password_hash

async def seed_data():
    db = get_database()
    
    # --- Clear All ---
    print("Clearing database...")
    await db.users.delete_many({})
    await db.workspaces.delete_many({})
    await db.departments.delete_many({})
    await db.buildings.delete_many({})
    await db.rooms.delete_many({})
    await db.students.delete_many({})
    await db.invitations.delete_many({})

    # --- User ---
    print("Creating Demo User...")
    user_id = await create_user({
        "email": "demo@campus.com",
        "full_name": "Demo Admin",
        "password_hash": get_password_hash("password")
    })
    
    # --- Workspace ---
    print("Creating Demo Workspace...")
    workspace_id = await create_workspace({
        "name": "Demo Workspace",
        "owner_id": user_id,
        "members": [user_id]
    })
    print(f"Workspace ID: {workspace_id}")
    
    # --- Departments ---
    departments = [
        Department(id="CSE", name="Computer Science and Engineering", workspace_id=workspace_id),
        Department(id="ECE", name="Electronics and Communication Engineering", workspace_id=workspace_id),
        Department(id="ME", name="Mechanical Engineering", workspace_id=workspace_id)
    ]
    
    print("Seeding Departments...")
    await db.departments.insert_many([d.model_dump() for d in departments])
    
    # --- Buildings ---
    buildings = [
        Building(id="BGB", name="Bill Gates Bhavan", workspace_id=workspace_id),
        Building(id="SRB", name="Sarvepalli Radhakrishnan Bhavan", workspace_id=workspace_id),
        Building(id="LB", name="Library Block", workspace_id=workspace_id)
    ]
    
    print("Seeding Buildings...")
    await db.buildings.insert_many([b.model_dump() for b in buildings])
    
    # --- Rooms ---
    rooms = [
        # BGB Rooms
        Room(id="101", name="BGB Room 101", capacity=30, building_id="BGB", workspace_id=workspace_id),
        Room(id="102", name="BGB Room 102", capacity=30, building_id="BGB", workspace_id=workspace_id),
        Room(id="201", name="BGB Room 201", capacity=40, building_id="BGB", workspace_id=workspace_id),
        # SRB Rooms
        Room(id="105", name="SRB Seminar Room", capacity=50, building_id="SRB", workspace_id=workspace_id),
        Room(id="210", name="SRB Conf Room", capacity=20, building_id="SRB", workspace_id=workspace_id)
    ]
    
    print("Seeding Rooms...")
    await db.rooms.insert_many([h.model_dump() for h in rooms])
    
    # --- Students ---
    students = []
    programs = ["B.Tech", "M.Tech"]
    
    for i in range(50):
        dept = departments[i % 3]
        prog = programs[i % 2]
        sid = f"S{2024000 + i}"
        
        # Assign courses based on dept
        courses = []
        if dept.id == "CSE":
            courses = ["CS101", "CS102"]
        elif dept.id == "ECE":
            courses = ["EC101", "EC102"]
        else:
            courses = ["ME101", "ME102"]
        
        # Add a common course
        if i % 2 == 0:
            courses.append("MA101")
            
        student = Student(
            id=sid,
            name=f"Student {i+1}",
            enrolled_courses=courses,
            program=prog,
            department_id=dept.id,
            workspace_id=workspace_id
        )
        students.append(student)
        
    print("Seeding Students...")
    await db.students.insert_many([s.model_dump() for s in students])
    
    print(f"Seeding Complete! Demo User: demo@campus.com / password")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_data())
