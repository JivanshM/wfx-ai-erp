"""FastAPI entry point. Run locally with:  uvicorn app.main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="WFX AI ERP API",
    description="Backend for the AI-native ERP exploration platform",
    version="1.0.0",
)

# CORS: allows the frontend (different domain) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # will be restricted to the deployed frontend URL later
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Simple check that the server is alive (used by Render too)."""
    return {"status": "ok"}
