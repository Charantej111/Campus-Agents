from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, EmailStr
import re

# --- Auth & Workspace Models ---

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    full_name: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Workspace(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    owner_id: str
    members: List[str] = Field(default_factory=list) # List of user_ids
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Invitation(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    workspace_id: str
    email: EmailStr
    token: str
    status: str = "pending" # pending, accepted, expired
    created_at: datetime = Field(default_factory=datetime.utcnow)

# --- Exam Domain Models ---

class Department(BaseModel):
    id: str = Field(..., description="Department ID e.g., CSE")
    name: str = Field(..., description="Department Name e.g., Computer Science")
    workspace_id: str

class Degree(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., description="Degree name e.g., B.Tech, M.Tech")
    workspace_id: str

class Program(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., description="Full program name e.g., B.Tech in CSE")
    degree_id: str
    department_id: str
    workspace_id: str

class Building(BaseModel):
    id: str = Field(..., description="Building ID e.g., BGB")
    name: str = Field(..., description="Building Name e.g., Bill Gates Bhavan")
    workspace_id: str
    floors: int = 0

class Student(BaseModel):
    id: str = Field(..., description="Roll number/Student ID")
    name: str
    enrolled_courses: List[str] = Field(default_factory=list)
    program_id: str = "Unknown"
    batch_year: int = Field(default_factory=lambda: datetime.utcnow().year)
    semester: int = 1
    workspace_id: str

class Room(BaseModel):
    id: str = Field(..., description="3 digit number room_no, 1st digit is floor_number and next two digits are room_number series in that floor")
    name: str = "classroom"
    capacity: int
    rows: int = 10
    columns: int = 6
    building_id: str
    floor_id: int = 1
    workspace_id: str
    seating_type: Literal["Three", "Two", "Single"] = "Single"

    @field_validator('id')
    @classmethod
    def validate_id(cls, v: str) -> str:
        if not re.match(r'^\d{3}$', v):
            raise ValueError('Room ID must be a 3 digit number')
        return v

class CalendarEvent(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    title: str = Field(..., description="Event or Holiday Name")
    date: str = Field(..., description="YYYY-MM-DD format")
    type: Literal['holiday', 'event'] = "holiday"
    workspace_id: str

class ExamCycle(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., description="E.g. Midterms 2026")
    semester: int = 1
    batch_year: int = Field(default_factory=lambda: datetime.utcnow().year)
    program_ids: List[str] = Field(default_factory=list, description="List of programs participating in this cycle")
    student_ids: List[str] = Field(default_factory=list, description="Computed list of students participating")
    workspace_id: str

class Course(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    code: str
    name: str
    semester: int = 1
    program_ids: List[str] = Field(default_factory=list)
    batch_ids: List[int] = Field(default_factory=list)
    # department_id: str
    workspace_id: str

class TimetableEntry(BaseModel):
    course_code: str
    course_name: Optional[str] = None
    date: str  # YYYY-MM-DD
    start_time: str # HH:MM
    end_time: str # HH:MM
    session: str = "morning" # 'morning' or 'afternoon'
    program_ids: List[str] = Field(default_factory=list, description="Programs for which this exam is conducted in parallel")
    batch_year: int = 0

class ExamPlan(BaseModel):
    timetable: List[TimetableEntry]
    conflicts: List[str] = Field(default_factory=list)
