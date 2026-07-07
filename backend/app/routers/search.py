"""Product search API - powered by Typesense (keyword + semantic hybrid)."""

import base64

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from openai import OpenAI

from app import config, search_index
from app.ratelimit import rate_limit_ok

router = APIRouter(prefix="/api/search", tags=["search"])

# Vision-capable LLM (used to describe uploaded garment photos)
vision_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=config.OPENROUTER_API_KEY,
    timeout=30.0,
    max_retries=1,
)

ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB


def run_search(q, limit, category=None):
    """The one place that actually talks to Typesense (both endpoints use it)."""
    if search_index.client is None:
        raise HTTPException(503, "Search is not configured on this server.")

    search_params = {
        "q": q,
        # listing "embedding" here is what turns on hybrid (semantic) search
        "query_by": "style_name,category,fabric,color,print,brand,embedding",
        "per_page": limit,
        "exclude_fields": "embedding",  # don't send 384 floats back to the browser
    }
    if category:
        search_params["filter_by"] = f"category:={category}"

    result = search_index.client.collections[search_index.COLLECTION].documents.search(
        search_params
    )

    hits = []
    for h in result["hits"]:
        doc = h["document"]
        # smaller distance = closer meaning. Hits found only by keyword
        # carry no vector_distance, so they get no score (not a fake 1.0).
        if "vector_distance" in h:
            doc["match_score"] = round(1 - h["vector_distance"], 4)
        else:
            doc["match_score"] = None
        hits.append(doc)

    return {"query": q, "found": result["found"], "hits": hits}


@router.get("")
def search_products(
    q: str = Query(..., min_length=1, description="e.g. 'blue floral dress'"),
    limit: int = Query(12, ge=1, le=50),
    category: str | None = None,
):
    """Searches products by keywords AND meaning at the same time."""
    return run_search(q, limit, category)


@router.post("/by-image")
async def search_by_image(
    request: Request,
    image: UploadFile = File(...),
    limit: int = Query(12, ge=1, le=50),
):
    """Upload a garment photo and get visually similar products.

    How it works: a vision model looks at the photo and writes a short
    product description ("black oversized hoodie, solid"), and that
    description goes through the same semantic search as text queries.
    """
    ip = request.client.host if request.client else "unknown"
    if not rate_limit_ok(ip):
        raise HTTPException(429, "Too many searches - wait a minute and try again.")

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Please upload a JPG, PNG or WebP image.")
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image too large - maximum 4 MB.")

    # detail:"low" = the model sees a small version of the image,
    # which is plenty for "what garment is this" and keeps cost tiny
    b64 = base64.b64encode(data).decode()
    response = vision_client.chat.completions.create(
        model=config.OPENROUTER_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this garment for a product search in under 15 words: "
                        "garment type, color, pattern, style. Reply with only the description.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image.content_type};base64,{b64}",
                            "detail": "low",
                        },
                    },
                ],
            }
        ],
        max_tokens=60,
        temperature=0,
    )
    description = (response.choices[0].message.content or "").strip()
    if not description:
        raise HTTPException(502, "Could not understand the image, please try another photo.")

    return {"description": description, **run_search(description, limit)}


@router.post("/reindex")
def reindex(x_admin_token: str = Header(default="")):
    """Refreshes the search index from the database.

    Needs the admin token header - rebuilding generates 1000 embeddings,
    so strangers must not be able to trigger it in a loop.
    """
    if not config.REINDEX_TOKEN or x_admin_token != config.REINDEX_TOKEN:
        raise HTTPException(403, "Not allowed.")
    return search_index.reindex()
