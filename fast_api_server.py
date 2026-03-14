import os
import uuid
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import timedelta, datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from fastapi import UploadFile, File, Form, BackgroundTasks
import pandas as pd
import io

import uvicorn
from dotenv import load_dotenv

# --- Internal Imports ---
from placement_cell_agent.models import InterviewRound, MockTest, Question
from placement_cell_agent.graph import graph
from exam_agent.graph import scheduling_graph
from exam_agent.allocation_graph import allocation_graph
from exam_agent.models import Building, Room, Department, Student, ExamCycle, Course, Program, Degree, CalendarEvent, TimetableEntry, RoomAllocation
from db import (
    save_generation_to_db, get_generation_history,
    create_user, get_user_by_email,
    create_workspace, get_workspaces_for_user, get_workspace_by_id, add_member_to_workspace,
    update_workspace, delete_workspace,
    create_invitation, get_invitation_by_token, update_invitation_status,
    create_building, create_room, create_department, create_student,
    get_all_buildings, get_all_rooms, get_all_departments, get_all_students,
    create_exam_cycle, get_all_exam_cycles, create_course, get_all_courses,
    create_program, get_all_programs, create_degree, get_all_degrees,
    get_database, get_latest_exam_plan, save_exam_plan,
    create_calendar_event, get_calendar_events,
    delete_document, update_document,
    create_assignment, get_all_assignments, get_assignment_by_id, delete_assignment as db_delete_assignment,
    create_submission, get_assignment_submissions, get_submission_by_roll,
    update_assignment_reminder_sent, get_assignments_needing_reminder, get_filtered_students
)
# ... imports ...

# ... existing routes ...

from auth_utils import (
    get_password_hash, verify_password, create_access_token, decode_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from email_utils import send_invitation_email, send_assignment_notification, send_deadline_reminder

load_dotenv()

logger = logging.getLogger(__name__)

# --- Uploads Directory ---
UPLOADS_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "student_lists").mkdir(exist_ok=True)
(UPLOADS_DIR / "submissions").mkdir(exist_ok=True)

class AssignmentStudentParams(BaseModel):
    roll_number: str
    name: str = ""
    email: str

class AssignmentCreateRequest(BaseModel):
    title: str
    description: str = ""
    subject_name: str
    section: str = ""
    batch: str = ""
    deadline: str
    students: List[AssignmentStudentParams]

app = FastAPI(title="Campus Agent API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Configuration ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- Dependency: Get Current User ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# --- Pydantic Models ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class Token(BaseModel):
    access_token: str
    token_type: str

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    is_owner: bool

class InviteRequest(BaseModel):
    email: EmailStr

class JDRequest(BaseModel):
    job_description: str

class AgentResponse(BaseModel):
    id: Optional[str] = None
    company_name: Optional[str]
    role_name: Optional[str]
    inferred_rounds: List[Dict[str, Any]]
    generated_tests: List[Dict[str, Any]]
    research_confidence: float
    web_research_results: Optional[str]
    errors: List[str]
    created_at: Optional[str] = None

class ExamRequest(BaseModel):
    workspace_id: str
    exam_cycle_id: str
    gap_between_exams: int = 1
    allow_two_exams_per_day: bool = False
    morning_slot_start: str = "09:00"
    morning_slot_end: str = "12:00"
    afternoon_slot_start: str = "14:00"
    afternoon_slot_end: str = "17:00"
    start_date: str
    end_date: Optional[str] = None
    custom_instructions: str = ""
    consider_holidays: bool = True
    max_exam_duration_hours: int = 3
    min_exam_duration_hours: int = 1
    max_exams_per_day: int = 2
    max_exams_per_student_per_day: int = 1
    buffer_days_before_first_exam: int = 0
    buffer_days_after_last_exam: int = 0
    prioritize_large_exams_first: bool = True
    distribute_exams_evenly: bool = True
    avoid_consecutive_days_for_same_course: bool = True
    avoid_weekends: bool = True
    specific_course_dates: Optional[Dict[str, str]] = None # e.g., {"CS101": "2024-05-10"}
    specific_course_slots: Optional[Dict[str, str]] = None # e.g., {"CS101": "morning"}

class ExamResponse(BaseModel):
    timetable: List[Dict[str, Any]]
    conflicts: List[str]
    status: str
    errors: List[str]

class ExamSelection(BaseModel):
    course_code: str
    date: str
    session: str

class RoomExamAssignment(BaseModel):
    room_id: str
    building_id: str
    course_codes: List[str]  # which exams this room covers

class AllocationRequest(BaseModel):
    workspace_id: str
    exam_cycle_id: str
    exams: List[ExamSelection]
    room_assignments: List[RoomExamAssignment]
    custom_instructions: str = ""

class AllocationResponse(BaseModel):
    room_allocations: List[Dict[str, Any]]
    conflicts: List[str]
    status: str
    errors: List[str]

def pydantic_to_dict(obj):
    if hasattr(obj, "model_dump"): return obj.model_dump()
    if hasattr(obj, "dict"): return obj.dict()
    if isinstance(obj, list): return [pydantic_to_dict(i) for i in obj]
    if isinstance(obj, dict): return {k: pydantic_to_dict(v) for k, v in obj.items()}
    return obj

# --- Auth Routes ---

@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    existing = await get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(user.password)
    user_data = {
        "email": user.email,
        "full_name": user.full_name,
        "password_hash": hashed_pw
    }
    await create_user(user_data)
    
    # Login immediately
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Return user info without sensitive data
    return {
        "id": current_user["_id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name", "")
    }

# --- Workspace Routes ---

@app.post("/workspaces", response_model=WorkspaceResponse)
async def create_new_workspace(ws: WorkspaceCreate, current_user: dict = Depends(get_current_user)):
    ws_data = {
        "name": ws.name,
        "owner_id": current_user["_id"],
        "members": [current_user["_id"]] # Owner is also a member
    }
    ws_id = await create_workspace(ws_data)
    return {
        "id": ws_id,
        "name": ws.name,
        "owner_id": current_user["_id"],
        "is_owner": True
    }

@app.get("/workspaces", response_model=List[WorkspaceResponse])
async def list_my_workspaces(current_user: dict = Depends(get_current_user)):
    workspaces = await get_workspaces_for_user(current_user["_id"])
    return [
        {
            "id": w["_id"],
            "name": w["name"],
            "owner_id": w["owner_id"],
            "is_owner": w["owner_id"] == current_user["_id"]
        }
        for w in workspaces
    ]

@app.put("/workspaces/{workspace_id}")
async def update_workspace_endpoint(workspace_id: str, data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    ws = await get_workspace_by_id(workspace_id)
    if not ws or ws["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only owner can update workspace")
    success = await update_workspace(workspace_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"message": "Workspace updated"}

@app.delete("/workspaces/{workspace_id}")
async def delete_workspace_endpoint(workspace_id: str, current_user: dict = Depends(get_current_user)):
    success = await delete_workspace(workspace_id, current_user["_id"])
    if not success:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace or workspace not found")
    return {"message": "Workspace deleted"}

@app.post("/workspaces/{workspace_id}/invite")
async def invite_member(
    workspace_id: str, 
    invite: InviteRequest, 
    current_user: dict = Depends(get_current_user)
):
    ws = await get_workspace_by_id(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    # Check permission (only members can invite? usually owner/admin, let's say any member for now)
    if current_user["_id"] not in ws["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Check if user already exists in workspace logic? For now assume adding new email.
    
    token = str(uuid.uuid4())
    invite_data = {
        "workspace_id": workspace_id,
        "email": invite.email,
        "token": token,
        "status": "pending",
        "invited_by": current_user["_id"]
    }
    await create_invitation(invite_data)
    
    # Send Email
    invite_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/join?token={token}"
    email_sent = send_invitation_email(invite.email, ws["name"], invite_link)
    
    if not email_sent:
        return {"message": "Invitation created but email failed (check logs/console).", "token": token}
        
    return {"message": "Invitation sent successfully"}

@app.post("/workspaces/join")
async def join_workspace(token: str, current_user: dict = Depends(get_current_user)):
    invite = await get_invitation_by_token(token)
    if not invite or invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")
        
    # Add user to workspace
    await add_member_to_workspace(invite["workspace_id"], current_user["_id"])
    await update_invitation_status(token, "accepted")
    
    return {"message": "Joined workspace successfully"}

# --- Data Management Routes ---

@app.get("/workspaces/{workspace_id}/buildings", response_model=List[Building])
async def list_buildings(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_buildings(workspace_id)

@app.post("/workspaces/{workspace_id}/buildings", response_model=Dict[str, Any])
async def add_building(workspace_id: str, building: Building, current_user: dict = Depends(get_current_user)):
    if building.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    # Validate non-empty id/name
    if not building.id or not building.id.strip() or not building.name or not building.name.strip():
        raise HTTPException(status_code=400, detail="Building id and name must be non-empty")
    id = await create_building(building.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/rooms", response_model=List[Room])
async def list_rooms(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_rooms(workspace_id)

@app.post("/workspaces/{workspace_id}/rooms", response_model=Dict[str, Any])
async def add_room(workspace_id: str, room: Room, current_user: dict = Depends(get_current_user)):
    if room.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    # Validate non-empty id/name
    if not room.id or not room.id.strip() or not room.name or not room.name.strip():
        raise HTTPException(status_code=400, detail="Room id and name must be non-empty")
    id = await create_room(room.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/departments", response_model=List[Department])
async def list_departments(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_departments(workspace_id)

@app.post("/workspaces/{workspace_id}/departments", response_model=Dict[str, Any])
async def add_department(workspace_id: str, dept: Department, current_user: dict = Depends(get_current_user)):
    if dept.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    id = await create_department(dept.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/degrees", response_model=List[Degree])
async def list_degrees(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_degrees(workspace_id)

@app.post("/workspaces/{workspace_id}/degrees", response_model=Dict[str, Any])
async def add_degree(workspace_id: str, degree: Degree, current_user: dict = Depends(get_current_user)):
    if degree.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    id = await create_degree(degree.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/buildings/{building_id}/rooms", response_model=List[Room])
async def list_rooms_in_building(workspace_id: str, building_id: str, current_user: dict = Depends(get_current_user)):
    from db import get_rooms_by_building
    return await get_rooms_by_building(workspace_id, building_id)

# --- Calendar API ---

@app.post("/workspaces/{workspace_id}/calendar/events", response_model=Dict[str, Any])
async def add_calendar_event(workspace_id: str, event: CalendarEvent, current_user: dict = Depends(get_current_user)):
    try:
        event_dict = event.model_dump()
        event_dict["workspace_id"] = workspace_id
        event_id = await create_calendar_event(event_dict)
        return {"id": event_id, "message": "Calendar event added"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workspaces/{workspace_id}/calendar", response_model=List[Dict[str, Any]])
async def list_calendar_events(workspace_id: str, current_user: dict = Depends(get_current_user)):
    try:
        events = await get_calendar_events(workspace_id)
        # Dynamic Public Holidays could be injected here
        # Return merged events
        for e in events:
             e["id"] = e.pop("_id", None)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/workspaces/{workspace_id}/calendar/{event_id}", response_model=Dict[str, Any])
async def delete_calendar_event(workspace_id: str, event_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if event_id.startswith("sunday_") or event_id.startswith("new_year_"):
            raise HTTPException(status_code=400, detail="Cannot delete default system holidays")
        
        db = get_database()
        from bson import ObjectId
        await db.calendar_events.delete_one({"_id": ObjectId(event_id), "workspace_id": workspace_id})
        return {"message": "Event deleted"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

# --- Exam Cycles API ---

async def compute_cycle_data(workspace_id: str, semester: int, batch_year: int):
    """Helper to auto-compute students and programs for an exam cycle."""
    students_in_workspace = await get_all_students(workspace_id)
    
    # Filter students by semester and batch_year
    matching_students = [s for s in students_in_workspace if s.get("semester") == semester and s.get("batch_year") == batch_year]
    
    # Extract unique program_ids from matching students, ensuring they are strings
    detected_program_ids = sorted(list(set([str(s.get("program_id")) for s in matching_students if s.get("program_id")])))
    
    return {
        "student_ids": [str(s["_id"]) for s in matching_students],
        "program_ids": detected_program_ids,
        "matching_students_count": len(matching_students),
        "detected_programs_count": len(detected_program_ids)
    }

@app.post("/workspaces/{workspace_id}/exam_cycles", response_model=Dict[str, Any])
async def add_exam_cycle(workspace_id: str, cycle: ExamCycle, current_user: dict = Depends(get_current_user)):
    try:
        cycle_dict = cycle.model_dump()
        cycle_dict["workspace_id"] = workspace_id
        
        # Auto-compute students and programs
        computed = await compute_cycle_data(workspace_id, cycle.semester, cycle.batch_year)
        cycle_dict["student_ids"] = computed["student_ids"]
        cycle_dict["program_ids"] = computed["program_ids"]
        
        cycle_id = await create_exam_cycle(cycle_dict)
        return {
            "id": cycle_id, 
            "message": "Exam Cycle created", 
            "students_added": computed["matching_students_count"],
            "programs_detected": computed["detected_programs_count"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workspaces/{workspace_id}/exam_cycles", response_model=List[Dict[str, Any]])
async def list_exam_cycles(workspace_id: str, current_user: dict = Depends(get_current_user)):
    try:
        cycles = await get_all_exam_cycles(workspace_id)
        for c in cycles:
             c["id"] = c.pop("_id", None)
        return cycles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workspaces/{workspace_id}/programs", response_model=List[Program])
async def list_programs(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_programs(workspace_id)

@app.post("/workspaces/{workspace_id}/programs", response_model=Dict[str, Any])
async def add_program(workspace_id: str, program: Program, current_user: dict = Depends(get_current_user)):
    if program.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    id = await create_program(program.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/courses", response_model=List[Course])
async def list_courses(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_courses(workspace_id)

@app.post("/workspaces/{workspace_id}/courses", response_model=Dict[str, Any])
async def add_course(workspace_id: str, course: Course, current_user: dict = Depends(get_current_user)):
    if course.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    id = await create_course(course.model_dump())
    return {"id": id}

@app.post("/workspaces/{workspace_id}/students", response_model=Dict[str, Any])
async def add_student(workspace_id: str, student: Student, current_user: dict = Depends(get_current_user)):
    if student.workspace_id != workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID mismatch")
    id = await create_student(student.model_dump())
    return {"id": id}

@app.get("/workspaces/{workspace_id}/students", response_model=List[Student])
async def list_students(workspace_id: str, current_user: dict = Depends(get_current_user)):
    return await get_all_students(workspace_id)

@app.get("/workspaces/{workspace_id}/batches", response_model=List[int])
async def list_batches(workspace_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection failed")
        batches = await db.students.distinct("batch_year", {"workspace_id": workspace_id})
        return sorted([b for b in batches if isinstance(b, int)])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/workspaces/{workspace_id}/students/import")
async def import_students(workspace_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Validate required columns
        required_cols = ['id', 'name', 'semester']
        if not all(col in df.columns for col in required_cols):
            raise HTTPException(status_code=400, detail=f"Excel must have columns: {', '.join(required_cols)}")
        
        students_created = 0
        for _, row in df.iterrows():
            student_data = {
                "id": str(row['id']),
                "name": str(row['name']),
                "semester": int(row['semester']) if pd.notna(row['semester']) else 1,
                "program_id": str(row.get('program_id', 'Unknown')),
                "enrolled_courses": str(row.get('enrolled_courses', '')).split(',') if pd.notna(row.get('enrolled_courses')) else [],
                "workspace_id": workspace_id
            }
            await create_student(student_data)
            students_created += 1
        
        return {"message": f"Successfully imported {students_created} students"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

# --- Generic CRUD Endpoints for Refinements ---

@app.delete("/workspaces/{workspace_id}/{resource_type}/{item_id}")
async def delete_item(workspace_id: str, resource_type: str, item_id: str, current_user: dict = Depends(get_current_user)):
    # Simple mapping for resource_type to collection name
    # "courses" -> "courses", "exams" -> "exams", "buildings" -> "buildings", etc.
    # Validate resource type
    valid_types = ["courses", "exams", "exam_cycles", "buildings", "rooms", "departments", "students", "programs", "degrees"]
    if resource_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid resource type")
        
    success = await delete_document(resource_type, item_id, workspace_id)
    if not success:
         raise HTTPException(status_code=404, detail="Item not found or could not be deleted")
    return {"message": "Deleted successfully"}


@app.delete("/workspaces/{workspace_id}/{resource_type}")
async def delete_item_by_query(workspace_id: str, resource_type: str, id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    # Allow deletion by query parameter `id` when path item_id is not convenient (e.g., empty string ids)
    valid_types = ["courses", "exams", "exam_cycles", "buildings", "rooms", "departments", "students", "programs", "degrees", "exam_plans"]
    if resource_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid resource type")

    if id == "all":
        from db import delete_all_documents
        success = await delete_all_documents(resource_type, workspace_id)
        return {"message": f"Deleted all {resource_type} successfully"}

    if id is None:
        raise HTTPException(status_code=400, detail="Missing id query parameter")

    success = await delete_document(resource_type, id, workspace_id)
    if not success:
         raise HTTPException(status_code=404, detail="Item not found or could not be deleted")
    return {"message": "Deleted successfully"}

@app.put("/workspaces/{workspace_id}/{resource_type}/{item_id}")
async def update_item(workspace_id: str, resource_type: str, item_id: str, data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    valid_types = ["courses", "exams", "exam_cycles", "buildings", "rooms", "departments", "students", "programs", "degrees"]
    if resource_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid resource type")
    
    # Ensure workspace_id in data matches
    data["workspace_id"] = workspace_id

    # If updating an exam cycle, re-compute student and program lists
    if resource_type == "exam_cycles":
        semester = data.get("semester")
        batch_year = data.get("batch_year")
        if semester is not None and batch_year is not None:
            computed = await compute_cycle_data(workspace_id, semester, batch_year)
            data["student_ids"] = computed["student_ids"]
            data["program_ids"] = computed["program_ids"]
    
    try:
        success = await update_document(resource_type, item_id, data, workspace_id)
        if not success:
             raise HTTPException(status_code=404, detail="Item not found or no changes made")
        return {"message": "Updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Agent Routes ---

@app.post("/generate", response_model=AgentResponse)
async def generate_interview_plan(request: JDRequest, current_user: dict = Depends(get_current_user)):
    # Existing placement agent logic... keeping it mostly same but requiring auth now?
    # User didn't explicitly say secure it, but "users must be part of a workspace... shared environment".
    # Placement agent isn't strictly workspace bound in prompt description as much as Exam agent.
    # But generally good to secure.
    
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job Description cannot be empty")
        
    try:
        initial_state = {
            "job_description": request.job_description,
            "company_name": None, 
            "role_name": None,
            "inferred_rounds": [],
            "generated_tests": [],
            "errors": [],
            "needs_web_research": False,
            "research_confidence": 0.0,
            "web_research_results": None
        }
        
        result = graph.invoke(initial_state)
        
        response_data = {
            "company_name": result.get("company_name"),
            "role_name": result.get("role_name"),
            "inferred_rounds": pydantic_to_dict(result.get("inferred_rounds", [])),
            "generated_tests": pydantic_to_dict(result.get("generated_tests", [])),
            "research_confidence": result.get("research_confidence", 0.0),
            "web_research_results": result.get("web_research_results"),
            "errors": result.get("errors", [])
        }
        
        saved_id = await save_generation_to_db(response_data)
        return AgentResponse(**response_data, id=saved_id)
        
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workspaces/{workspace_id}/exam_plan", response_model=ExamResponse)
async def get_exam_plan(workspace_id: str, current_user: dict = Depends(get_current_user)):
    try:
        plan = await get_latest_exam_plan(workspace_id)
        if not plan:
            return {
                "timetable": [],
                "conflicts": [],
                "status": "start",
                "errors": []
            }
        
        # Clean up
        plan.pop("_id", None)
        plan.pop("workspace_id", None)
        plan.pop("created_at", None)
        
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/workspaces/{workspace_id}/exam_plan", response_model=Dict[str, Any])
async def save_exam_plan_endpoint(workspace_id: str, plan: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    try:
        from db import save_exam_plan
        saved_id = await save_exam_plan(workspace_id, plan)
        return {"id": saved_id, "message": "Exam plan saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/exam/schedule", response_model=ExamResponse)
async def schedule_exams(request: ExamRequest, current_user: dict = Depends(get_current_user)):
    ws = await get_workspace_by_id(request.workspace_id)
    if not ws or current_user["_id"] not in ws.get("members", []):
         raise HTTPException(status_code=403, detail="Access to workspace denied")

    try:
        # Fetch exam cycle
        cycles = await get_all_exam_cycles(request.workspace_id)
        cycle_dict = next((c for c in cycles if str(c.get("_id", c.get("id"))) == request.exam_cycle_id), None)
        if not cycle_dict:
            raise HTTPException(status_code=404, detail="Exam cycle not found")
        exam_cycle = ExamCycle(**cycle_dict)
        
        # Fetch all courses for this workspace, then filter by exam cycle's semester & batch_year
        all_courses_data = await get_all_courses(request.workspace_id)
        cycle_courses = []
        cycle_program_ids = set(exam_cycle.program_ids)
        
        for c_data in all_courses_data:
            course = Course(**c_data)
            # Course belongs to this exam cycle if it matches the semester AND batch_year
            if course.semester == exam_cycle.semester and exam_cycle.batch_year in course.batch_ids:
                # Include course if any of its program_ids match the cycle's program_ids
                if any(pid in cycle_program_ids for pid in course.program_ids):
                    cycle_courses.append(course)
        
        if not cycle_courses:
            raise HTTPException(status_code=400, detail="No courses found matching this exam cycle's semester, batch year, and programs.")
        
        # Fetch students and holidays
        students_data = await get_all_students(request.workspace_id)
        students = [Student(**s) for s in students_data]
        
        events_data = await get_calendar_events(request.workspace_id)
        holidays = [CalendarEvent(**e) for e in events_data if e.get("type") == "holiday"]
        
        initial_state = {
            "workspace_id": request.workspace_id,
            "request_data": pydantic_to_dict(request),
            "students": students,
            "courses": cycle_courses,
            "exam_cycle": exam_cycle,
            "holidays": holidays,
            "timetable": [],
            "status": "start",
            "errors": [],
            "conflicts": []
        }
        
        result = await scheduling_graph.ainvoke(initial_state)
        
        timetable = [t.model_dump() for t in result.get("timetable", [])]
        
        response_payload = {
            "timetable": timetable,
            "conflicts": result.get("conflicts", []),
            "status": result.get("status", "unknown"),
            "errors": result.get("errors", [])
        }
        return response_payload
    except Exception as e:
        print(f"Error in exam scheduling: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Seat Allocation Endpoint ---

@app.post("/exam/allocate", response_model=AllocationResponse)
async def allocate_seats(request: AllocationRequest, current_user: dict = Depends(get_current_user)):
    ws = await get_workspace_by_id(request.workspace_id)
    if not ws or current_user["_id"] not in ws.get("members", []):
        raise HTTPException(status_code=403, detail="Access to workspace denied")
    
    try:
        # Fetch exam cycle
        cycles = await get_all_exam_cycles(request.workspace_id)
        cycle_dict = next((c for c in cycles if str(c.get("_id", c.get("id"))) == request.exam_cycle_id), None)
        if not cycle_dict:
            raise HTTPException(status_code=404, detail="Exam cycle not found")
        exam_cycle = ExamCycle(**cycle_dict)
        
        # Fetch rooms by their IDs
        all_rooms_data = await get_all_rooms(request.workspace_id)
        requested_room_ids = {ra.room_id for ra in request.room_assignments}
        rooms = []
        for r_data in all_rooms_data:
            r_copy = dict(r_data)
            r_copy.pop("_id", None)
            if r_copy.get("id") in requested_room_ids:
                rooms.append(Room(**r_copy))
        
        if not rooms:
            raise HTTPException(status_code=400, detail="None of the requested rooms were found.")
        
        # Build room-exam map
        room_exam_map = {}
        for ra in request.room_assignments:
            room_exam_map[ra.room_id] = ra.course_codes
        
        # Build timetable entries from the exam selections
        timetable_entries = [
            TimetableEntry(
                course_code=ex.course_code,
                date=ex.date,
                session=ex.session,
                start_time="",
                end_time=""
            )
            for ex in request.exams
        ]
        
        # Fetch courses
        all_courses_data = await get_all_courses(request.workspace_id)
        selected_codes = {ex.course_code for ex in request.exams}
        courses = [Course(**c) for c in all_courses_data if c.get("code") in selected_codes]
        
        # Fetch students
        students_data = await get_all_students(request.workspace_id)
        students = [Student(**s) for s in students_data]
        
        initial_state = {
            "workspace_id": request.workspace_id,
            "request_data": pydantic_to_dict(request),
            "students": students,
            "rooms": rooms,
            "timetable_entries": timetable_entries,
            "courses": courses,
            "room_exam_map": room_exam_map,
            "room_allocations": [],
            "conflicts": [],
            "status": "start",
            "errors": []
        }
        
        result = await allocation_graph.ainvoke(initial_state)
        
        room_allocations = [ra.model_dump() for ra in result.get("room_allocations", [])]
        
        return {
            "room_allocations": room_allocations,
            "conflicts": result.get("conflicts", []),
            "status": result.get("status", "unknown"),
            "errors": result.get("errors", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in seat allocation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history", response_model=List[AgentResponse])
async def get_history(current_user: dict = Depends(get_current_user)):
    # Filtering history by user? Or global? Keeping global for now as per minimal changes, but require auth.
    try:
        history = await get_generation_history(limit=20)
        results = []
        for item in history:
            item["id"] = item.pop("_id")
            if "created_at" in item:
                item["created_at"] = item["created_at"].isoformat()
            results.append(AgentResponse(**item))
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Assignment Agent Routes ---

@app.get("/workspaces/{workspace_id}/students/filter")
async def get_students_filtered(
    workspace_id: str,
    batch_year: Optional[int] = None,
    program_id: Optional[str] = None,
    semester: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get students filtered by batch, program, and semester for assignment creation."""
    try:
        students = await get_filtered_students(
            workspace_id, 
            batch_year=batch_year, 
            program_id=program_id, 
            semester=semester
        )
        return students
    except Exception as e:
        logger.error(f"Error fetching filtered students: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/workspaces/{workspace_id}/assignments")
async def create_new_assignment(
    workspace_id: str,
    request: AssignmentCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create an assignment with a specific list of students and send notification emails."""
    try:
        students_list = [s.model_dump() for s in request.students]
        
        if not students_list:
            raise HTTPException(status_code=400, detail="No students provided for the assignment.")
        
        # Create assignment document
        assignment_data = {
            "title": request.title,
            "description": request.description,
            "subject_name": request.subject_name,
            "section": request.section,
            "batch": request.batch,
            "deadline": request.deadline,
            "workspace_id": workspace_id,
            "created_by": current_user["_id"],
            "students": students_list,
            "total_students": len(students_list),
            "student_list_file": None  # No longer using file upload
        }
        
        assignment_id = await create_assignment(assignment_data)
        
        # Send emails in background
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8000")
        submission_link = f"{frontend_url}/submit/{assignment_id}"
        
        def send_emails_task():
            for student in students_list:
                try:
                    send_assignment_notification(
                        to_email=student["email"],
                        student_name=student["name"],
                        assignment_title=request.title,
                        deadline=request.deadline,
                        subject_name=request.subject_name,
                        submission_link=submission_link
                    )
                except Exception as e:
                    logger.error(f"Failed to send email to {student['email']}: {e}")
        
        background_tasks.add_task(send_emails_task)
        
        return {
            "id": assignment_id,
            "message": f"Assignment created. Sending notifications to {len(students_list)} students.",
            "total_students": len(students_list),
            "submission_link": submission_link
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/workspaces/{workspace_id}/assignments")
async def list_assignments(workspace_id: str, current_user: dict = Depends(get_current_user)):
    """List all assignments for a workspace."""
    try:
        assignments = await get_all_assignments(workspace_id)
        # Add submission count for each assignment
        for a in assignments:
            subs = await get_assignment_submissions(a["_id"])
            a["submitted_count"] = len(subs)
            a["id"] = a.pop("_id")
            if "created_at" in a and hasattr(a["created_at"], "isoformat"):
                a["created_at"] = a["created_at"].isoformat()
        return assignments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/workspaces/{workspace_id}/assignments/{assignment_id}")
async def get_assignment_detail(workspace_id: str, assignment_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed assignment info with submission analytics."""
    try:
        assignment = await get_assignment_by_id(assignment_id)
        if not assignment or assignment.get("workspace_id") != workspace_id:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        submissions = await get_assignment_submissions(assignment_id)
        
        # Calculate analytics
        total = assignment.get("total_students", 0)
        submitted = len(submissions)
        on_time = sum(1 for s in submissions if not s.get("is_late", False))
        late = submitted - on_time
        
        # Enrich submissions with download URLs
        for sub in submissions:
            if "submitted_at" in sub and hasattr(sub["submitted_at"], "isoformat"):
                sub["submitted_at"] = sub["submitted_at"].isoformat()
            sub["id"] = sub.pop("_id")
        
        assignment["id"] = assignment.pop("_id")
        if "created_at" in assignment and hasattr(assignment["created_at"], "isoformat"):
            assignment["created_at"] = assignment["created_at"].isoformat()
        
        return {
            **assignment,
            "analytics": {
                "total_students": total,
                "submitted": submitted,
                "pending": total - submitted,
                "on_time": on_time,
                "late": late,
                "submission_rate": round((submitted / total * 100), 1) if total > 0 else 0
            },
            "submissions": submissions
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/workspaces/{workspace_id}/assignments/{assignment_id}")
async def delete_assignment_endpoint(workspace_id: str, assignment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an assignment and its submissions."""
    success = await db_delete_assignment(assignment_id, workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment deleted successfully"}


@app.get("/workspaces/{workspace_id}/assignments/{assignment_id}/submissions")
async def list_submissions(workspace_id: str, assignment_id: str, current_user: dict = Depends(get_current_user)):
    """Get all submissions for an assignment."""
    assignment = await get_assignment_by_id(assignment_id)
    if not assignment or assignment.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    submissions = await get_assignment_submissions(assignment_id)
    for sub in submissions:
        if "submitted_at" in sub and hasattr(sub["submitted_at"], "isoformat"):
            sub["submitted_at"] = sub["submitted_at"].isoformat()
        sub["id"] = sub.pop("_id")
    return submissions


# --- Public Assignment Submission Routes (No Auth) ---

@app.get("/submit/{assignment_id}/info")
async def get_submission_info(assignment_id: str):
    """Public endpoint — get assignment info for submission page."""
    assignment = await get_assignment_by_id(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Only return public fields
    return {
        "id": assignment["_id"],
        "title": assignment["title"],
        "description": assignment.get("description", ""),
        "subject_name": assignment["subject_name"],
        "deadline": assignment["deadline"],
        "section": assignment.get("section", ""),
        "batch": assignment.get("batch", ""),
    }


@app.post("/submit/{assignment_id}")
async def submit_assignment(
    assignment_id: str,
    roll_number: str = Form(...),
    file: UploadFile = File(...),
):
    """Public endpoint — student submits assignment by roll number + file upload."""
    try:
        assignment = await get_assignment_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        # Check if this roll number is in the student list
        students = assignment.get("students", [])
        student = next((s for s in students if s["roll_number"] == roll_number.strip()), None)
        if not student:
            raise HTTPException(status_code=400, detail="Roll number not found in the student list for this assignment.")
        
        # Check for duplicate submission
        existing = await get_submission_by_roll(assignment_id, roll_number.strip())
        if existing:
            raise HTTPException(status_code=400, detail="You have already submitted this assignment.")
        
        # Determine if late
        deadline_str = assignment.get("deadline", "")
        is_late = False
        try:
            deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > deadline_dt:
                is_late = True
        except Exception:
            pass
        
        # Save file
        file_ext = os.path.splitext(file.filename or "file")[1]
        saved_filename = f"{assignment_id}_{roll_number.strip()}_{uuid.uuid4()}{file_ext}"
        file_path = UPLOADS_DIR / "submissions" / saved_filename
        
        file_contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(file_contents)
        
        # Create submission record
        submission_data = {
            "assignment_id": assignment_id,
            "roll_number": roll_number.strip(),
            "student_name": student.get("name", ""),
            "student_email": student.get("email", ""),
            "file_name": file.filename,
            "saved_file": saved_filename,
            "is_late": is_late
        }
        
        sub_id = await create_submission(submission_data)
        
        return {
            "id": sub_id,
            "message": "Assignment submitted successfully!" + (" (Late submission)" if is_late else ""),
            "is_late": is_late
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uploads/submissions/{filename}")
async def serve_submission_file(filename: str, token: str = None):
    """Serve uploaded submission files using query param token."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = decode_access_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Not authenticated")

    file_path = UPLOADS_DIR / "submissions" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)


# --- Deadline Reminder Background Task ---

async def check_deadline_reminders():
    """Check for assignments with upcoming deadlines and send reminders."""
    while True:
        try:
            assignments = await get_assignments_needing_reminder()
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            
            for assignment in assignments:
                submission_link = f"{frontend_url}/submit/{assignment['_id']}"
                students = assignment.get("students", [])
                
                # Get already-submitted roll numbers
                submissions = await get_assignment_submissions(assignment["_id"])
                submitted_rolls = {s["roll_number"] for s in submissions}
                
                # Only remind students who haven't submitted
                for student in students:
                    if student["roll_number"] not in submitted_rolls:
                        try:
                            send_deadline_reminder(
                                to_email=student["email"],
                                student_name=student["name"],
                                assignment_title=assignment["title"],
                                deadline=assignment["deadline"],
                                submission_link=submission_link
                            )
                        except Exception as e:
                            logger.error(f"Reminder email failed for {student['email']}: {e}")
                
                await update_assignment_reminder_sent(assignment["_id"])
                logger.info(f"Sent deadline reminders for assignment: {assignment['title']}")
        except Exception as e:
            logger.error(f"Error in deadline reminder check: {e}")
        
        await asyncio.sleep(3600)  # Check every hour


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_deadline_reminders())
    logger.info("Deadline reminder background task started.")


@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Static Files + SPA Fallback
frontend_dist = "dist" if os.path.exists("dist") else "frontend/dist"
if os.path.exists(frontend_dist):
    # Serve static assets (JS, CSS, images)
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")
    
    # SPA fallback: serve static files if they exist, else index.html for React Router
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Check if the path matches an actual file in dist (e.g. vite.svg, favicon.ico)
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html for React Router
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path, media_type="text/html")
        raise HTTPException(status_code=404, detail="Frontend not found")

if __name__ == "__main__":
    uvicorn.run("fast_api_server:app", host="0.0.0.0", port=8000, reload=True)

