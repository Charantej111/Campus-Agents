from typing import List, Optional, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator, EmailStr
import re

# --- Auth & Workspace Models ---

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    full_name: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Workspace(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    owner_id: str
    members: List[str] = Field(default_factory=list) # List of user_ids
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Invitation(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    workspace_id: str
    email: EmailStr
    token: str
    status: str = "pending" # pending, accepted, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    batch_year: int = Field(default_factory=lambda: datetime.now(timezone.utc).year)
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
    batch_year: int = Field(default_factory=lambda: datetime.now(timezone.utc).year)
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

# --- Seat Allocation Models ---

class SeatAllocation(BaseModel):
    seat_label: str  # e.g. "A1", "B3"
    bench_index: int  # 0-based bench index in the row
    seat_position: int  # position within bench (0, 1, or 2)
    student_id: str  # roll number
    student_name: str = ""
    course_code: str
    program_id: str = ""
    batch_year: int = 0

class RoomAllocation(BaseModel):
    room_id: str
    building_id: str
    room_name: str = "classroom"
    rows: int = 10
    columns: int = 6
    seating_type: Literal["Three", "Two", "Single"] = "Single"
    floor_id: int = 1
    exam_date: str = ""
    exam_session: str = ""
    course_codes: List[str] = Field(default_factory=list)
    course_names: List[str] = Field(default_factory=list)
    program_ids: List[str] = Field(default_factory=list)
    batch_years: List[int] = Field(default_factory=list)
    allocations: List[SeatAllocation] = Field(default_factory=list)
    total_seats: int = 0
    occupied_seats: int = 0
