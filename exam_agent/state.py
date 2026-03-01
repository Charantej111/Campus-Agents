from typing import List, TypedDict, Optional, Any
from .models import Student, ExamCycle, TimetableEntry, CalendarEvent, Course

class SchedulingState(TypedDict):
    # Input
    workspace_id: str
    request_data: dict # dict representation of ExamRequest
    
    # Context Data
    students: List[Student]
    courses: List[Course]  # Courses belonging to this exam cycle
    exam_cycle: ExamCycle
    holidays: List[CalendarEvent]
    
    # Output
    timetable: List[TimetableEntry]
    conflicts: List[str]
    
    # Flow Control
    status: str
    errors: List[str]
