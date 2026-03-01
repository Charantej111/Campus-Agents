import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Literal

from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, Field

from .models import ExamPlan, TimetableEntry, ExamCycle, Student, Course, CalendarEvent
from .state import SchedulingState
from .utils import get_llm_for_task

# --- SCHEDULING GRAPH NODES ---

class TimetableOutput(BaseModel):
    timetable: List[TimetableEntry] = Field(..., description="The generated list of exam timetable records")
    conflicts: List[str] = Field(default_factory=list, description="List of any conflicts detected during generation")

def scheduling_setup_node(state: SchedulingState) -> SchedulingState:
    """Initialize state with necessary data for scheduling."""
    return {
        **state,
        "status": "planning",
        "errors": state.get("errors", []),
        "conflicts": state.get("conflicts", [])
    }

def modify_timetable_llm_node(state: SchedulingState) -> SchedulingState:
    """Use AI Agent to modify the generated parallel timetable based on custom instructions."""
    exam_cycle = state.get("exam_cycle")
    courses = state.get("courses", [])
    holidays = state.get("holidays", [])
    students = state.get("students", [])
    request_data = state.get("request_data", {})
    algo_timetable = state.get("timetable", [])
    
    if not exam_cycle:
        return {**state, "errors": state.get("errors", []) + ["Missing ExamCycle in state."]}
    
    if not algo_timetable:
        return {**state, "errors": state.get("errors", []) + ["No algorithmic timetable available to modify."]}
    
    start_date = request_data.get("start_date")
    gap = request_data.get("gap_between_exams", 1)
    allow_two_per_day = request_data.get("allow_two_exams_per_day", False)
    
    morning_start = request_data.get('morning_slot_start', '09:00')
    morning_end = request_data.get('morning_slot_end', '12:00')
    afternoon_start = request_data.get('afternoon_slot_start', '14:00')
    afternoon_end = request_data.get('afternoon_slot_end', '17:00')
    custom_inst = request_data.get("custom_instructions", "")
    
    holiday_dates = [h.date for h in holidays if h.type == 'holiday']
    
    slots = []
    if morning_start and morning_end:
        slots.append(f"Morning: {morning_start}-{morning_end}")
    if afternoon_start and afternoon_end:
        slots.append(f"Afternoon: {afternoon_start}-{afternoon_end}")
        
    algo_timetable_str = "\n".join([
        f"- {t.date} | {t.start_time}-{t.end_time} | {t.session} | {t.course_code}: {t.course_name} (Programs: {', '.join(t.program_ids)})"
        for t in algo_timetable
    ])
    
    llm = get_llm_for_task()
    structured_llm = llm.with_structured_output(TimetableOutput)
    
    prompt_text = f"""
    You are an expert University Exam Scheduling Agent.
    
    I have an ALGORITHMICALY GENERATED TIMETABLE below. Your task is to MODIFY it STRICTLY based on the CUSTOM INSTRUCTIONS provided by the user, while ensuring you return a complete and valid timetable.
    
    ALGORITHMICALLY GENERATED TIMETABLE (Input):
    {algo_timetable_str}
    
    CUSTOM INSTRUCTIONS FOR MODIFICATION:
    {custom_inst}
    
    DATES & SLOTS ALLOWED:
    - Start Date allowed: {start_date}
    - Available Slots: {slots}
    - Minimum Gap: {gap} day(s) between exams for any student.
    - Max Exams per day for a student: {'2 (one per slot)' if allow_two_per_day else '1'}
    
    HOLIDAYS (STRICTLY AVOID unless explicitly requested by custom instructions to ignore):
    {holiday_dates}
    
    RULES FOR MODIFICATION:
    - Keep all untouched timetable entries EXACTLY as they are in the generated timetable.
    - Only change the dates, sessions, and start/end times of the specific courses mentioned in the custom instructions, and subsequently adjust any other courses if a conflict arises because of your shift.
    - If the custom instructions explicitly command splitting parallel courses, do so. Otherwise, keep them parallel. Don't just conduct single exam in a slot unless explicitly requested.
    - Ensure parallel courses (same course code but different programs, or different courses strictly bundled together across programs) remain strictly parallel unless the instructions explicitly command splitting them.
    - Ensure EVERY course from the input timetable is present in your output timetable. DO NOT lose any records.
    
    OUTPUT FORMAT:
    Provide the finalized, fully modified list of timetable records in Ascending order of date of examination. Each record must contain:
    - date (YYYY-MM-DD)
    - course_code
    - course_name
    - start_time & end_time (Matching the slots provided)
    - session (Morning/Afternoon)
    - program_ids (List of programs participating for this record)
    - batch_year ({exam_cycle.batch_year})
    """
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", prompt_text),
        ("human", "Modify the timetable according to the custom instructions and return the full timetable.")
    ])
    
    try:
        response = prompt | structured_llm
        result = response.invoke({})
        
        if not result or not result.timetable:
            return {**state, "errors": state.get("errors", []) + ["LLM returned empty timetable"]}

        return {
            **state,
            "timetable": result.timetable,
            "conflicts": result.conflicts,
            "status": "complete"
        }
    except Exception as e:
        return {
            **state,
            "errors": state.get("errors", []) + [f"Timetable modification failed: {str(e)}"],
            "status": "error"
        }

def generate_timetable_algorithmic_node(state: SchedulingState) -> SchedulingState:
    """Algorithmically generate a parallel timetable using graph coloring."""
    exam_cycle = state.get("exam_cycle")
    courses = state.get("courses", [])
    holidays = state.get("holidays", [])
    students = state.get("students", [])
    request_data = state.get("request_data", {})
    
    if not courses:
        return {**state, "errors": state.get("errors", []) + ["No courses found for this exam cycle."]}
        
    start_date_str = request_data.get("start_date")
    gap = request_data.get("gap_between_exams", 1)
    allow_two_per_day = request_data.get("allow_two_exams_per_day", False)
    avoid_weekends = request_data.get("avoid_weekends", True)
    
    morning_start = request_data.get('morning_slot_start', '09:00')
    morning_end = request_data.get('morning_slot_end', '12:00')
    afternoon_start = request_data.get('afternoon_slot_start', '14:00')
    afternoon_end = request_data.get('afternoon_slot_end', '17:00')
    
    holiday_dates = set(h.date for h in holidays if h.type == 'holiday')
    
    course_codes = [c.code for c in courses]
    course_map = {c.code: c for c in courses}
    
    course_students = {c.code: set() for c in courses}
    for student in students:
        for cc in student.enrolled_courses:
            if cc in course_students:
                course_students[cc].add(student.id)
                
    conflicts = {c.code: set() for c in courses}
    for i in range(len(courses)):
        for j in range(i + 1, len(courses)):
            c1 = courses[i]
            c2 = courses[j]
            shared_programs = set(c1.program_ids).intersection(set(c2.program_ids))
            shared_students = course_students[c1.code].intersection(course_students[c2.code])
            
            if shared_programs or shared_students:
                conflicts[c1.code].add(c2.code)
                conflicts[c2.code].add(c1.code)
                
    sorted_codes = sorted(course_codes, key=lambda x: len(conflicts[x]), reverse=True)
    
    course_colors = {}
    max_color = -1
    
    for code in sorted_codes:
        neighbor_colors = {course_colors[neighbor] for neighbor in conflicts[code] if neighbor in course_colors}
        
        color = 0
        while color in neighbor_colors:
            color += 1
            
        course_colors[code] = color
        max_color = max(max_color, color)
        
    color_groups = [[] for _ in range(max_color + 1)]
    for code, color in course_colors.items():
        color_groups[color].append(course_map[code])
            
    timetable = []
    
    import datetime
    try:
        current_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
    except ValueError:
        return {**state, "errors": state.get("errors", []) + ["Invalid start date format (use YYYY-MM-DD)"]}
    
    def is_valid_date(d: datetime.datetime):
        d_str = d.strftime("%Y-%m-%d")
        if d_str in holiday_dates:
            return False
        if avoid_weekends and d.weekday() == 6:
            return False
        return True
        
    def get_next_valid_date(d: datetime.datetime):
        while not is_valid_date(d):
            d += datetime.timedelta(days=1)
        return d
        
    current_date = get_next_valid_date(current_date)
    
    color_idx = 0
    sessions_assigned_today = 0
    
    while color_idx <= max_color:
        courses_in_session = color_groups[color_idx]
        
        if allow_two_per_day:
            if sessions_assigned_today == 0:
                slot_session = "Morning"
                start_time = morning_start
                end_time = morning_end
                sessions_assigned_today += 1
            else:
                slot_session = "Afternoon"
                start_time = afternoon_start
                end_time = afternoon_end
                sessions_assigned_today = 0
        else:
            slot_session = "Morning"
            start_time = morning_start
            end_time = morning_end
            sessions_assigned_today = 0
            
        date_str = current_date.strftime("%Y-%m-%d")
        
        for course in courses_in_session:
            timetable.append(TimetableEntry(
                course_code=course.code,
                course_name=course.name,
                date=date_str,
                start_time=start_time,
                end_time=end_time,
                session=slot_session,
                program_ids=course.program_ids,
                batch_year=course.batch_ids[0] if course.batch_ids else exam_cycle.batch_year
            ))
            
        color_idx += 1
        
        if sessions_assigned_today == 0 and color_idx <= max_color:
            current_date += datetime.timedelta(days=1 + gap)
            current_date = get_next_valid_date(current_date)

    return {
        **state,
        "timetable": timetable,
        "status": "complete"
    }


# --- BUILD GRAPHS ---

def should_use_llm(state: SchedulingState) -> Literal["modify_timetable_llm", "__end__"]:
    request_data = state.get("request_data", {})
    custom_inst = request_data.get("custom_instructions", "").strip()
    if custom_inst:
        return "modify_timetable_llm"
    return "__end__"

sched_builder = StateGraph(SchedulingState)
sched_builder.add_node("setup", scheduling_setup_node)
sched_builder.add_node("generate_timetable_algo", generate_timetable_algorithmic_node)
sched_builder.add_node("modify_timetable_llm", modify_timetable_llm_node)

sched_builder.add_edge(START, "setup")
sched_builder.add_edge("setup", "generate_timetable_algo")
sched_builder.add_conditional_edges("generate_timetable_algo", should_use_llm)
sched_builder.add_edge("modify_timetable_llm", END)

scheduling_graph = sched_builder.compile()
