"""Product search API - powered by Typesense (keyword + semantic hybrid)."""

from fastapi import APIRouter, Header, HTTPException, Query

from app import config, search_index

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search_products(
    q: str = Query(..., min_length=1, description="e.g. 'blue floral dress'"),
    limit: int = Query(12, ge=1, le=50),
    category: str | None = None,
):
    """Searches products by keywords AND meaning at the same time."""
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


@router.post("/reindex")
def reindex(x_admin_token: str = Header(default="")):
    """Refreshes the search index from the database.

    Needs the admin token header - rebuilding generates 1000 embeddings,
    so strangers must not be able to trigger it in a loop.
    """
    if not config.REINDEX_TOKEN or x_admin_token != config.REINDEX_TOKEN:
        raise HTTPException(403, "Not allowed.")
    return search_index.reindex()
