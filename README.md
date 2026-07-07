# WFX AI ERP Explorer

An AI-native exploration platform built on top of apparel-industry ERP data.
Business users can ask questions in plain English, search products by text or image,
and explore finished goods — without writing SQL or learning ERP screens.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Database | Supabase (PostgreSQL) | Managed Postgres with instant APIs |
| Backend | FastAPI (Python) | Simple, fast, auto-generated API docs |
| Frontend | React + Vite + Tailwind CSS | Modern, fast dev experience |
| NL → SQL | Vanna AI + OpenRouter | Open-source natural-language-to-SQL framework |
| Search | Typesense Cloud | Typo-tolerant, semantic product search |
| Deployment | Render (backend) + Vercel (frontend) | As per requirements |

## Repository Structure

- `main` branch — documentation + database schema & import scripts
- `backend` branch — FastAPI backend
- `frontend` branch — React frontend

## Database Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run `database/schema.sql` to create all tables.
3. Place the provided CSV data files in the `data/` folder
   (they are intentionally **not** committed — the sample data is confidential).
4. Create `database/.env` from `database/.env.example` and fill in your Supabase credentials.
5. Run the import script:

```bash
cd database
pip install -r requirements.txt
python import_data.py
```

More sections (backend, frontend, deployment) will be added as they are built.
