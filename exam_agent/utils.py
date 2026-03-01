import random
from typing import List
from .models import Student, Room

# --- LLM Utils ---
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models import BaseChatModel

def get_llm_for_task(context_size: int = 1000) -> BaseChatModel:
    """Simple router for LLM selection."""
    # Default to Groq Llama 3 or similar if available/configured
    # Using the same model name as placement agent for consistency
    return ChatGroq(
        model_name="openai/gpt-oss-120b",
        temperature=0.1
    )
