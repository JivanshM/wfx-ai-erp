"""Product search API - powered by Typesense (keyword + semantic hybrid)."""

import base64
import json

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile

from app import config, llm, search_index
from app.db import run_query
from app.ratelimit import rate_limit_ok

router = APIRouter(prefix="/api/search", tags=["search"])

ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB

# Fields the uploaded-photo search matches on, and how strongly. Only visually
# obvious traits are used (no fabric/brand - you can't read those off a photo).
# category is boosted hardest, then color, then print.
IMAGE_QUERY_BY = "style_name,category,color,print,embedding"
IMAGE_QUERY_BY_WEIGHTS = "2,5,4,3,2"

# Distinct category/color values, loaded once from the DB and cached, so the
# vision model can only pick tags that actually exist in the catalog.
_vocab_cache = None


def format_hits(result):
    """Turns raw Typesense hits into clean API responses."""
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
    return hits


def run_search(q, limit, category=None, query_by=None, query_by_weights=None):
    """The one place that actually talks to Typesense (both endpoints use it).

    query_by / query_by_weights let a caller override which fields are matched
    and how strongly they rank; text search uses the defaults, image search
    passes its own visual-field weighting.
    """
    if search_index.client is None:
        raise HTTPException(503, "Search is not configured on this server.")

    search_params = {
        "q": q,
        # listing "embedding" here is what turns on hybrid (semantic) search
        "query_by": query_by or "style_name,category,fabric,color,print,brand,embedding",
        "per_page": limit,
        "exclude_fields": "embedding",  # don't send 384 floats back to the browser
    }
    if query_by_weights:
        # make some fields (e.g. category) outweigh others when ranking matches
        search_params["query_by_weights"] = query_by_weights
    if category:
        search_params["filter_by"] = f"category:={category}"

    result = search_index.client.collections[search_index.COLLECTION].documents.search(
        search_params
    )
    return {"query": q, "found": result["found"], "hits": format_hits(result)}


@router.get("")
def search_products(
    q: str = Query(..., min_length=1, description="e.g. 'blue floral dress'"),
    limit: int = Query(12, ge=1, le=50),
    category: str | None = None,
):
    """Searches products by keywords AND meaning at the same time."""
    return run_search(q, limit, category)


@router.get("/similar/{style_number}")
def similar_products(style_number: str, limit: int = Query(8, ge=1, le=24)):
    """Finds the products whose embeddings sit closest to the given product's.

    This is a pure vector search: "give me the nearest neighbours of this
    product's vector" - no text query involved.
    """
    if search_index.client is None:
        raise HTTPException(503, "Search is not configured on this server.")
    try:
        result = search_index.client.collections[
            search_index.COLLECTION
        ].documents.search(
            {
                "q": "*",
                "vector_query": f"embedding:([], id: {style_number}, k: {limit})",
                "exclude_fields": "embedding",
                "per_page": limit,
            }
        )
    except Exception:
        raise HTTPException(404, f"Unknown product: {style_number}")

    return {"style_number": style_number, "found": result["found"], "hits": format_hits(result)}


def catalog_vocab():
    """Distinct category and color values from the catalog, cached in memory.

    Loaded once (lazily) and reused. On a DB error we return empty lists
    WITHOUT caching them, so image search just free-forms (the old behaviour)
    and self-heals on the next request instead of staying degraded.
    """
    global _vocab_cache
    if _vocab_cache is not None:
        return _vocab_cache
    try:
        vocab = {}
        for field in ("category", "color"):
            rows = run_query(
                f"select distinct {field} as v from finished_goods "
                f"where {field} is not null and {field} <> '' order by v"
            )
            vocab[field] = [r["v"] for r in rows]
    except Exception as exc:
        print(f"WARNING: could not load catalog vocab, image search will free-form: {exc}")
        return {"category": [], "color": []}
    _vocab_cache = vocab
    return _vocab_cache


def describe_garment(content_type, b64):
    """Vision model tags the photo using ONLY real catalog values.

    Returns {category, color, print, keywords}. Grounding the model in the
    actual vocabulary means each value maps onto a product field, so we can
    safely boost it in ranking without inventing a category that matches
    nothing.
    """
    vocab = catalog_vocab()
    prompt = (
        "You are tagging a garment PHOTO for a fashion catalog search. "
        "Return ONLY a JSON object with keys category, color, print, keywords.\n"
        f"- category: the single closest from {vocab['category']} or \"\" if unclear.\n"
        f"- color: the single closest from {vocab['color']} or \"\".\n"
        '- print: "Printed" if it has any pattern/graphic/stripe/floral, else "Solid".\n'
        "- keywords: up to 6 words for shape/style/details.\n"
        "Choose category and color ONLY from the given lists. Reply with JSON only."
    )
    response = llm.client.chat.completions.create(
        model=config.OPENROUTER_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        # detail:"low" = the model sees a small version, plenty
                        # for tagging a garment and it keeps the token cost tiny
                        "image_url": {
                            "url": f"data:{content_type};base64,{b64}",
                            "detail": "low",
                        },
                    },
                ],
            }
        ],
        max_tokens=120,
        temperature=0,
        response_format={"type": "json_object"},
    )
    return parse_attrs(response.choices[0].message.content or "")


def parse_attrs(raw):
    """Best-effort parse of the model's JSON reply into clean string fields."""
    text = raw.strip()
    if text.startswith("```"):  # tolerate ```json ... ``` fences
        text = text.strip("`")
        if text[:4].lower() == "json":
            text = text[4:]
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        data = {}
    attrs = {}
    for key in ("category", "color", "print"):
        val = data.get(key, "")
        attrs[key] = val.strip() if isinstance(val, str) else ""
    kw = data.get("keywords", "")
    if isinstance(kw, list):
        kw = " ".join(str(x) for x in kw)
    attrs["keywords"] = kw.strip() if isinstance(kw, str) else ""
    return attrs


def attrs_to_query(attrs):
    """Turn the tags into (search query, human-readable summary).

    color + print + category anchor the match; keywords add shape/detail. The
    summary is what the UI shows on the "AI saw: ..." line.
    """
    anchor = [a for a in (attrs.get("color"), attrs.get("print"), attrs.get("category")) if a]
    query = " ".join([*anchor, attrs.get("keywords", "")]).strip()
    summary = " ".join(anchor)
    if attrs.get("keywords"):
        summary = f"{summary} - {attrs['keywords']}" if summary else attrs["keywords"]
    return query, summary


@router.post("/by-image")
async def search_by_image(
    request: Request,
    image: UploadFile = File(...),
    limit: int = Query(12, ge=1, le=50),
):
    """Upload a garment photo and get visually similar products.

    A vision model tags the photo with catalog-grounded attributes
    (category, color, print + descriptive keywords), and those attributes
    drive a weighted hybrid search that leans hardest on category and color.
    """
    ip = request.client.host if request.client else "unknown"
    if not rate_limit_ok(ip):
        raise HTTPException(429, "Too many searches - wait a minute and try again.")

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Please upload a JPG, PNG or WebP image.")
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image too large - maximum 4 MB.")

    b64 = base64.b64encode(data).decode()
    try:
        attrs = describe_garment(image.content_type, b64)
    except Exception as exc:
        print(f"WARNING: image tagging failed: {exc}")
        raise HTTPException(502, "Could not read the image, please try another photo.")

    query, summary = attrs_to_query(attrs)
    if not query:
        raise HTTPException(502, "Could not understand the image, please try another photo.")

    payload = run_search(
        query, limit, query_by=IMAGE_QUERY_BY, query_by_weights=IMAGE_QUERY_BY_WEIGHTS
    )
    # "description" keeps the existing UI working; "attributes" carries the
    # structured tags for anything that wants them later.
    return {"description": summary, "attributes": attrs, **payload}


@router.post("/reindex")
def reindex(x_admin_token: str = Header(default="")):
    """Refreshes the search index from the database.

    Needs the admin token header - rebuilding generates 1000 embeddings,
    so strangers must not be able to trigger it in a loop.
    """
    if not config.REINDEX_TOKEN or x_admin_token != config.REINDEX_TOKEN:
        raise HTTPException(403, "Not allowed.")
    return search_index.reindex()
