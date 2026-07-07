"""Central place for all settings. Values come from the .env file."""

import os

from dotenv import load_dotenv

load_dotenv()

# Postgres connection string (Supabase session pooler)
DATABASE_URL = os.getenv("DATABASE_URL", "")
