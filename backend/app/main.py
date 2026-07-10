"""FastAPI entry point. Run locally with:  uvicorn app.main:app --reload"""

import os
import threading
import time
import urllib.request
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import buyers, dashboard, products, query, search, suppliers

KEEP_ALIVE_MINUTES = 5  # free tier sleeps after 15 idle minutes - ping well before


def keep_alive():
    """Pings our own public URL forever so the free-tier host never sees us
    as idle and never puts us to sleep (the cause of 60-second cold starts).

    The host only counts INBOUND traffic, so the request must leave the
    machine and come back through the public front door - which is exactly
    what hitting our own public URL does. RENDER_EXTERNAL_URL is set by the
    host automatically; when running locally it's absent and we do nothing.
    """
    url = os.environ.get("RENDER_EXTERNAL_URL")
    if not url:
        return
    while True:
        time.sleep(KEEP_ALIVE_MINUTES * 60)
        try:
            urllib.request.urlopen(f"{url}/health", timeout=30)
        except Exception:
            pass  # one missed ping is fine - the next is 5 minutes away


@asynccontextmanager
async def lifespan(app):
    """Runs once when the server starts."""
    # daemon=True means this thread dies quietly with the server
    threading.Thread(target=keep_alive, daemon=True).start()
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
app.include_router(suppliers.router)
app.include_router(buyers.router)


@app.get("/health")
def health():
    """Simple check that the server is alive (used by Render too)."""
    return {"status": "ok"}
