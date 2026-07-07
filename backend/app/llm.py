"""One shared LLM client for everything outside Vanna
(photo descriptions, confidence ratings)."""

from openai import OpenAI

from app import config

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=config.OPENROUTER_API_KEY,
    timeout=30.0,
    max_retries=1,
)
