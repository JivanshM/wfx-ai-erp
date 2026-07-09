"""Typesense setup: builds the product search index.

Typesense is a search engine: unlike the database it handles typos,
ranks results by relevance, and can search by MEANING. The special
"embedding" field below tells Typesense to convert each product's text
into a vector using a built-in ML model (e5-small). Searches then use
BOTH keywords and meaning (hybrid search), so "blue floral dress" finds
relevant garments even without exact word matches.
"""

import json
import urllib.request

import typesense

from app import config
from app.db import run_query

COLLECTION = "products"

# Domain synonyms so real shopper words hit the right category:
# "tee" -> T-Shirt, "jumper"/"pullover" -> Sweatshirt, "pants" -> Trousers.
# Typesense v28+ stores these as a top-level "synonym set" that searches
# reference at query time (see run_search). Kept in code so a fresh deploy
# rebuilds them automatically.
SYNONYM_SET = "apparel"
SYNONYMS = [
    {"id": "tee", "synonyms": ["tee", "tees", "tshirt", "t-shirt"]},
    {"id": "sweatshirt", "synonyms": ["jumper", "pullover", "sweater", "sweatshirt", "jersey"]},
    {"id": "trousers", "synonyms": ["pants", "trousers", "slacks", "chinos"]},
    {"id": "jeans", "synonyms": ["jeans", "denim", "denims"]},
    {"id": "hoodie", "synonyms": ["hoodie", "hoody", "hooded"]},
    {"id": "jacket", "synonyms": ["jacket", "coat", "blazer", "outerwear"]},
]
# Flipped on once the set is confirmed live, so a search never asks Typesense
# for a synonym set that failed to build (which would error the query).
synonyms_ready = False

# Built inside try/except: with no API key the constructor raises,
# and that must disable search only - not the whole backend.
client = None
try:
    client = typesense.Client(
        {
            "nodes": [
                {"host": config.TYPESENSE_HOST, "port": 443, "protocol": "https"}
            ],
            "api_key": config.TYPESENSE_API_KEY,
            # generating 1000 embeddings on first index takes a while
            "connection_timeout_seconds": 300,
        }
    )
except Exception as exc:
    print(f"WARNING: Typesense client init failed, /api/search disabled: {exc}")

schema = {
    "name": COLLECTION,
    "fields": [
        {"name": "style_number", "type": "string"},
        {"name": "style_name", "type": "string"},
        {"name": "category", "type": "string", "facet": True},
        {"name": "fabric", "type": "string", "facet": True},
        {"name": "color", "type": "string", "facet": True},
        {"name": "print", "type": "string", "facet": True},
        {"name": "season", "type": "string", "facet": True},
        {"name": "brand", "type": "string", "facet": True},
        {"name": "supplier_name", "type": "string", "facet": True},
        {"name": "gsm", "type": "int32"},
        {"name": "selling_price", "type": "float"},
        {"name": "image_url", "type": "string", "index": False, "optional": True},
        # Typesense builds this vector itself from the listed fields
        {
            "name": "embedding",
            "type": "float[]",
            "embed": {
                "from": ["style_name", "category", "fabric", "color", "print"],
                "model_config": {"model_name": "ts/e5-small-v2"},
            },
        },
    ],
}


def collection_exists():
    try:
        client.collections[COLLECTION].retrieve()
        return True
    except typesense.exceptions.ObjectNotFound:
        return False


def reindex():
    """Builds or refreshes the search index from the database.

    Upserts into the existing collection instead of dropping it first,
    so search keeps working while a refresh runs.
    """
    if client is None:
        raise RuntimeError("Typesense is not configured (missing host/api key)")
    if not collection_exists():
        client.collections.create(schema)

    rows = run_query(
        """
        select fg.style_number, fg.style_name, fg.category, fg.fabric,
               fg.gsm, fg.color, fg.print, fg.season, fg.brand,
               fg.selling_price, fg.image_url,
               s.company_name as supplier_name
        from finished_goods fg
        join suppliers s on s.supplier_id = fg.supplier_id
        """
    )
    docs = []
    for r in rows:
        doc = dict(r)
        doc["id"] = r["style_number"]  # stable id, so re-imports update in place
        doc["gsm"] = int(r["gsm"] or 0)  # "or 0" guards against NULLs
        doc["selling_price"] = float(r["selling_price"] or 0)
        docs.append(doc)

    results = client.collections[COLLECTION].documents.import_(
        docs, {"action": "upsert"}
    )
    failed = [r for r in results if not r.get("success")]
    print(f"Typesense: indexed {len(docs) - len(failed)} products, {len(failed)} failed")
    return {"indexed": len(docs) - len(failed), "failed": len(failed)}


def ensure_synonyms():
    """Upsert the apparel synonym set (idempotent).

    The v30 synonym-set API isn't in the Python client yet, so this makes the
    raw HTTPS call. Best-effort: if it fails, search still works, just without
    the "tee -> T-Shirt" style vocabulary mapping.
    """
    global synonyms_ready
    url = f"https://{config.TYPESENSE_HOST}/synonym_sets/{SYNONYM_SET}"
    req = urllib.request.Request(
        url,
        method="PUT",
        data=json.dumps({"items": SYNONYMS}).encode(),
        headers={
            "X-TYPESENSE-API-KEY": config.TYPESENSE_API_KEY,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()
    synonyms_ready = True
    print(f"Typesense: synonym set '{SYNONYM_SET}' ready ({len(SYNONYMS)} groups)")


def ensure_ready():
    """Called at server startup: builds the index only if it's missing,
    then makes sure the synonym set exists."""
    if client is None:
        raise RuntimeError("Typesense is not configured (missing host/api key)")
    if not collection_exists():
        reindex()
    try:
        ensure_synonyms()
    except Exception as exc:
        print(f"WARNING: synonym setup failed, search runs without synonyms: {exc}")
