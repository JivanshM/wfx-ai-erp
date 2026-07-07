"""FastAPI entry point. Run locally with:  uvicorn app.main:app --reload"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dashboard, products, query, search


@asynccontextmanager
async def lifespan(app):
    """Runs once when the server starts."""
    # Load Vanna's training data (skips instantly if already loaded).
    # Wrapped in try/except so a missing key doesn't kill the whole API.
    try:
        from app import nl2sql

        nl2sql.train_if_needed()
    except Exception as exc:
        print(f"WARNING: Vanna setup failed, /api/query will not work: {exc}")
    # Build the search index if it doesn't exist yet (same protection idea)
    try:
        from app import search_index

        search_index.ensure_ready()
    except Exception as exc:
        print(f"WARNING: Typesense setup failed, /api/search will not work: {exc}")
    yield


app = FastAPI(
    title="WFX AI ERP API",
    description="Backend for the AI-native ERP exploration platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allows the frontend (different domain) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # will be restricted to the deployed frontend URL later
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(query.router)
app.include_router(search.router)


@app.get("/health")
def health():
    """Simple check that the server is alive (used by Render too)."""
    return {"status": "ok"}
