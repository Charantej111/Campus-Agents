import os
import json
from dotenv import load_dotenv

# Load env vars (e.g. GROQ_API_KEY)
load_dotenv(override=True)

from typing import List, Literal, cast, Optional, Dict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, Field

# New imports for Phase 2
from langchain_tavily import TavilySearch
from langchain_community.tools import DuckDuckGoSearchResults

from .models import InterviewRound, MockTest, Question
from .state import PlacementState
from .utils import get_llm_for_task, truncate_search_results, get_cached_research, cache_research

# Constants
MODEL_NAME = "openai/gpt-oss-120b" 
TEMPERATURE = 0.3
MAX_PARALLEL_TESTS = 6

# Initialize ChatGroq (Primary) - Kept for legacy reference but utils.get_llm_for_task is preferred
groq_llm = ChatGroq(
    model=MODEL_NAME,
    temperature=TEMPERATURE
)

# --- Wrapper Models ---
class JDExtraction(BaseModel):
    company_name: Optional[str] = Field(None, description="Name of the company")
    role_name: Optional[str] = Field(None, description="Name of the role")
    explicit_rounds: List[str] = Field(default_factory=list, description="List of rounds explicitly mentioned in JD")
    selection_process_quality: Literal["explicit", "partial", "missing"] = Field(
        "missing", 
        description="Quality of selection process info: explicit (clear stages), partial (vague), missing (none)"
    )

class RoundsOutput(BaseModel):
    rounds: List[InterviewRound]

class QuestionsOutput(BaseModel):
    questions: List[Question]

# --- Nodes ---

def parse_jd_node(state: PlacementState) -> PlacementState:
    """Extracts company and role information from the JD."""
    jd = state["job_description"]
    
    # Use router to pick model (parsing task)
    llm = get_llm_for_task("parsing", len(jd))
    structured_llm = llm.with_structured_output(JDExtraction)

    prompt_text = """
    You are an expert HR AI. Analyze the following Job Description.
    Extract:
    1. company_name
    2. role_name
    3. explicit_rounds
    4. selection_process_quality
    
    Quality Definitions:
    - "explicit": Clear stages like "Programming Test", "Technical Interview I/II".
    - "partial": Vague mentions like "multiple rounds of interviews", "assessment".
    - "missing": No interview process mentioned.
    
    Job Description:
    {jd}
    """
    
    prompt = ChatPromptTemplate.from_template(prompt_text)
    chain = prompt | structured_llm
    
    try:
        response = chain.invoke({"jd": jd})
        data = response if response else JDExtraction()
        
        # Calculate confidence
        confidence_map = {"explicit": 0.9, "partial": 0.5, "missing": 0.2}
        confidence = confidence_map.get(data.selection_process_quality, 0.2)
        
        return {
            **state,
            "company_name": data.company_name,
            "role_name": data.role_name,
            "research_confidence": confidence,
            "needs_web_research": data.selection_process_quality in ["partial", "missing"],
            "errors": []
        }
    except Exception as e:
        return {
            **state,
            "errors": state.get("errors", []) + [f"parse_jd_node error: {str(e)}"],
            # Default values on error
            "needs_web_research": True,
            "research_confidence": 0.0
        }

def research_router_node(state: PlacementState) -> Literal["web_research", "decide_rounds"]:
    """Routes to web research if needed, else directly to decide_rounds."""
    
    # Route to web research if:
    # 1. JD flagged as needing research
    # 2. Confidence below threshold
    # 3. Company name is known (can't search without it)
    
    if state.get("needs_web_research") and state.get("company_name"):
        # If low confidence, definitely research
        if state.get("research_confidence", 0.0) < 0.7:
            return "web_research"
            
    return "decide_rounds"

def web_research_node(state: PlacementState) -> PlacementState:
    """Performs web research on company interview process."""
    
    company = state["company_name"]
    role = state.get("role_name", "software engineer")
    
    # Check cache first
    cached = get_cached_research(company)
    if cached:
        return {
            **state,
            "web_research_results": cached,
            "research_confidence": 0.8 # Boost confidence from cache
        }
    
    # Initialize Tavily
    # Note: Requires TAVILY_API_KEY in env
    tavily = TavilySearch(
        max_results=5,
        search_depth="advanced",
        include_answer=True,
        include_raw_content=True
    )
    
    # Generate search queries
    queries = [
        f"{company} {role} interview process rounds stages",
        f"{company} campus placement interview pattern",
        f"{company} technical interview format"
    ]
    
    all_results = []
    errors = []
    
    # Execute searches
    for query in queries:
        try:
            results = tavily.invoke({"query": query})
            all_results.extend(results)
        except Exception as e:
            errors.append(f"Tavily failed for '{query}': {str(e)}")
            # Fallback to DDG if Tavily fails
            try:
                ddg = DuckDuckGoSearchResults(max_results=3)
                results = ddg.invoke({"query": query})
                # DDG returns a string, parse or append differently? 
                # DDG tool returns string usually in LangChain community
                # Let's simple append the string if it's string
                if isinstance(results, str):
                     all_results.append({"content": results, "url": "ddg_result"})
                else:
                     all_results.extend(results)
            except Exception as e2:
                errors.append(f"DDG fallback failed: {str(e2)}")

    if not all_results:
        return {
            **state,
            "web_research_results": "No relevant web results found.",
            "web_research_queries": queries,
            "errors": state.get("errors", []) + errors
        }

    # Optimizations
    filtered_results = truncate_search_results(all_results)
    
    # Consolidate results using LLM
    try:
        consolidation_prompt = ChatPromptTemplate.from_template("""
        You are analyzing web search results about {company}'s interview process for {role}.
        
        Extract and summarize:
        1. Number and names of interview rounds/stages
        2. Types of assessments (MCQ, coding, system design, HR, etc.)
        3. Topics commonly tested
        4. Duration/difficulty mentions
        
        Search Results:
        {results}
        
        Provide a structured summary focusing on actionable interview process details.
        If results are contradictory, mention the most common pattern.
        """)
        
        # Use Router (Context might be large)
        llm = get_llm_for_task("research", len(str(filtered_results)))
        chain = consolidation_prompt | llm
        
        summary = chain.invoke({
            "company": company,
            "role": role,
            "results": json.dumps(filtered_results, indent=2)
        })
        
        summary_content = summary.content
        cache_research(company, summary_content)
        
        return {
            **state,
            "web_research_queries": queries,
            "web_research_results": summary_content,
            "research_confidence": 0.75, # Boost confidence
            "errors": state.get("errors", []) + errors # Preserve non-fatal errors
        }
        
    except Exception as e:
        return {
            **state,
            "errors": state.get("errors", []) + [f"consolidation error: {str(e)}"]
        }

def decide_rounds_node(state: PlacementState) -> PlacementState:
    """Decides the interview rounds based on JD and Role, merged with Web research."""
    
    # Build context-aware prompt
    web_context = ""
    if state.get("web_research_results"):
        web_context = f"""
        ADDITIONAL CONTEXT FROM WEB RESEARCH:
        {state["web_research_results"]}
        
        Use this to enrich your round detection. Prioritize explicit JD info, 
        but fill gaps with web research patterns.
        """
        
    total_context_len = len(state["job_description"]) + len(state.get("web_research_results") or "")
    
    # Use router
    llm = get_llm_for_task("reasoning", total_context_len)
    structured_llm = llm.with_structured_output(RoundsOutput)
    
    system_instruction = f"""
    You are an expert technical recruiter. Based on the Job Description and Web Research (if available), decide the interview rounds.
    
    Job Description:
    {state["job_description"]}
    
    {web_context}
    
    Company: {state.get("company_name", "Unknown")}
    Role: {state.get("role_name", "Unknown")}
    
    Rules:
    - If "Programming Test" -> "coding" + "cs_mcq".
    - If "System Design" -> "cs_mcq" or "mixed".
    - If "Aptitude" -> "aptitude_mcq".
    - If no specific process (missing in JD and Web):
        - SWE/Developer: 1 Aptitude MCQ, 1 CS Fundamentals MCQ, 1 Coding Round.
        - BPO/Support: 1 Aptitude/Logic MCQ, 1 Verbal/Communication MCQ.
        
    Output a structured object containing a list of InterviewRound objects.
    """
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_instruction),
        ("human", "Generate interview rounds.")
    ])
    
    chain = prompt | structured_llm
    
    try:
        response = chain.invoke({})
        rounds = response.rounds if response else []
        return {**state, "inferred_rounds": rounds}
    except Exception as e:
         return {**state, "errors": state.get("errors", []) + [f"decide_rounds_node error: {str(e)}"]}

def expand_rounds_to_test_specs_node(state: PlacementState) -> PlacementState:
    """Converts InterviewRounds into MockTest specifications."""
    
    rounds = state["inferred_rounds"]
    generated_tests: List[MockTest] = []
    
    for i, rnd in enumerate(rounds):
        diff_profile = {"easy": 0, "medium": 0, "hard": 0}
        total_q = rnd.num_questions_estimate
        
        if rnd.round_type == "coding":
            total_q = max(1, min(total_q, 5)) 
            diff_profile["easy"] = 1
            diff_profile["medium"] = max(0, total_q - 2)
            diff_profile["hard"] = 1 if total_q > 1 else 0
        else:
            import math
            diff_profile["easy"] = math.floor(total_q * 0.3)
            diff_profile["hard"] = math.floor(total_q * 0.2)
            diff_profile["medium"] = total_q - diff_profile["easy"] - diff_profile["hard"]

        test_id = f"test_{i}_{rnd.round_name.replace(' ', '_').lower()}"
        
        mock_test = MockTest(
            test_id=test_id,
            title=f"{rnd.round_name} - {rnd.round_type.upper()}",
            round_type=rnd.round_type,
            duration_min=rnd.expected_duration_min,
            num_questions=total_q,
            difficulty_profile=diff_profile,
            topics=rnd.topics,
            questions=[]
        )
        generated_tests.append(mock_test)
        
    return {**state, "generated_tests": generated_tests}


def create_test_gen_node(test_index: int):
    """Factory function for parallel test generation node."""
    
    def generate_single_test_node(state: PlacementState) -> PlacementState | dict:
        generated_tests = state["generated_tests"]
        if test_index >= len(generated_tests):
            return {} 
            
        test = generated_tests[test_index]
        role = (state.get("role_name") or "").lower()
        is_bpo = any(kw in role for kw in ["bpo", "customer", "support", "chat", "service", "voice", "non-voice"])
        
        # Use router - test generation is usually moderate context, use default Groq unless huge
        llm = get_llm_for_task("reasoning", 1000) 
        structured_llm = llm.with_structured_output(QuestionsOutput)
        
        # Role-aware guidelines
        guidelines = ""
        if test.round_type == "coding":
            guidelines = "Generate ONLY coding problems. Include problem_statement, input/output format, constraints, sample_tests."
        elif test.round_type == "aptitude_mcq" and is_bpo:
            guidelines = "Generate aptitude MCQs for BPO: English grammar, comprehension, logical reasoning, basic math."
        elif test.round_type == "cs_mcq":
            guidelines = "Generate CS fundamentals MCQs: Data Structures, Algorithms, OS, DBMS, Networks."
        elif test.round_type == "mixed" and is_bpo:
             guidelines = "Generate 'Situational Judgment' questions. You MUST format these as standard MCQs. Scenario = question_text. Possible Actions = options (provide exactly 4). Correct Action = correct_option_index. Explanation = why."
        else:
            guidelines = "Generate mixed technical questions (conceptual + scenario based)."

        system_instruction = """
        You are an expert exam setter. Create {num} questions for a "{rtype}" test.
        Topics: {topics}.
        Difficulty: {diff}.
        
        {guidelines}
        
        CRITICAL: 
        - For MCQs: Provide exactly 4 options (strings) and correct_option_index (0-3).
        - For Coding: Provide full problem details.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_instruction),
            ("human", "Generate questions.")
        ])
        
        try:
            response = (prompt | structured_llm).invoke({
                "num": test.num_questions,
                "rtype": test.round_type,
                "topics": ', '.join(test.topics),
                "diff": json.dumps(test.difficulty_profile),
                "guidelines": guidelines
            })
            
            questions = response.questions if response else []
            valid_questions = []
            for q in questions:
                if q.question_type == "mcq":
                    if not q.options or len(q.options) != 4: continue
                    if q.correct_option_index is None: continue
                elif q.question_type == "coding":
                     if not q.problem_statement: continue
                valid_questions.append(q)
                
            test.questions = valid_questions
            return {"completed_tests": [test]}
            
        except Exception as e:
            # Fallback logic could be added here too if needed
            return {"errors": [f"Failed to generate {test.test_id}: {str(e)}"]}

    return generate_single_test_node

def validate_tests_node(state: PlacementState) -> PlacementState | dict:
    """Validates the generated tests."""
    completed = state.get("completed_tests", [])
    errors = state.get("errors", [])
    
    for test in completed:
        if len(test.questions) == 0:
             errors.append(f"Test {test.test_id} has 0 questions.")
        elif test.round_type == "coding":
             if any(q.question_type == "mcq" for q in test.questions):
                 errors.append(f"Test {test.test_id} (coding) contains MCQs.")
    
    return {"errors": errors, "generated_tests": completed} 


# --- Graph Construction ---

builder = StateGraph(PlacementState)

builder.add_node("parse_jd", parse_jd_node)
builder.add_node("web_research", web_research_node)
builder.add_node("decide_rounds", decide_rounds_node)
builder.add_node("expand_rounds_to_test_specs", expand_rounds_to_test_specs_node)
builder.add_node("validate_tests", validate_tests_node)

# Parallel nodes
for i in range(MAX_PARALLEL_TESTS):
    builder.add_node(f"gen_test_{i}", create_test_gen_node(i))

# Edges
builder.add_edge(START, "parse_jd")

# Conditional Routing
builder.add_conditional_edges(
    "parse_jd",
    research_router_node,
    {
        "web_research": "web_research",
        "decide_rounds": "decide_rounds"
    }
)
builder.add_edge("web_research", "decide_rounds")
builder.add_edge("decide_rounds", "expand_rounds_to_test_specs")

def route_to_test_generators(state: PlacementState) -> List[str]:
    num_tests = len(state["generated_tests"])
    return [f"gen_test_{i}" for i in range(min(num_tests, MAX_PARALLEL_TESTS))]

builder.add_conditional_edges(
    "expand_rounds_to_test_specs",
    route_to_test_generators,
    {f"gen_test_{i}": f"gen_test_{i}" for i in range(MAX_PARALLEL_TESTS)}
)

for i in range(MAX_PARALLEL_TESTS):
    builder.add_edge(f"gen_test_{i}", "validate_tests")

builder.add_edge("validate_tests", END)

graph = builder.compile()

