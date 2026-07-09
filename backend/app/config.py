"""Central place for all settings. Values come from the .env file."""

import os

from dotenv import load_dotenv

load_dotenv()

# Postgres connection string (Supabase session pooler) - full access
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Same database, but as a user that can only read.
# AI-generated SQL runs through this one. Falls back to the main
# connection if not configured (e.g. on a fresh local setup) -
# loudly, because that weakens a safety layer.
READONLY_DATABASE_URL = os.getenv("READONLY_DATABASE_URL", "") or DATABASE_URL
if not os.getenv("READONLY_DATABASE_URL"):
    print("WARNING: READONLY_DATABASE_URL not set - AI SQL will use the full-access connection")

# OpenRouter gives us access to LLMs through one API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
# Text model: natural-language-to-SQL, dashboard insights, confidence scoring.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
# Vision model: describing an uploaded photo for image search. A separate
# setting so image search can use a stronger (or cheaper/faster) multimodal
# model than the text model; falls back to OPENROUTER_MODEL when unset.
OPENROUTER_VISION_MODEL = os.getenv("OPENROUTER_VISION_MODEL", "") or OPENROUTER_MODEL

# Typesense Cloud (product search)
TYPESENSE_HOST = os.getenv("TYPESENSE_HOST", "")
TYPESENSE_API_KEY = os.getenv("TYPESENSE_API_KEY", "")

# Secret token required to trigger a search reindex
REINDEX_TOKEN = os.getenv("REINDEX_TOKEN", "")
