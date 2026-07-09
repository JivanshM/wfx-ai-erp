"""Natural Language to SQL API - the main AI feature."""

import json
import re

import pandas as pd
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import config, llm, nl2sql
from app.db import run_query
from app.ratelimit import rate_limit_ok

router = APIRouter(prefix="/api/query", tags=["ai query"])

# words that must never appear in AI-generated SQL
# ("into" blocks "select ... into new_table", which creates a table)
FORBIDDEN_WORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|into)\b",
    re.IGNORECASE,
)

MAX_ROWS = 200      # never send huge result sets to the browser
SUMMARY_ROWS = 30   # the LLM only needs a sample of rows to write the answer


def is_safe_select(sql: str) -> bool:
    """Safety layer 1: allow only a single read-only SELECT statement.

    (Safety layer 2 lives in the database itself: the query runs as the
    wfx_readonly user, which Postgres does not allow to change anything.)
    """
    body = sql.strip().rstrip(";")
    if ";" in body:  # blocks multi-statement tricks like "select 1; drop table x"
        return False
    first_word = body.split(None, 1)[0].lower() if body.strip() else ""
    if first_word not in ("select", "with"):
        return False
    return not FORBIDDEN_WORDS.search(body)


def rate_confidence(question, sql):
    """Asks the model to self-rate the generated SQL (0-100).

    Not a guarantee - just the model double-checking its own work,
    which catches obvious mismatches between question and query.
    """
    try:
        response = llm.client.chat.completions.create(
            model=config.OPENROUTER_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "A user asked this question about an apparel ERP database:\n"
                        f"{question}\n\nThis SQL was generated to answer it:\n{sql}\n\n"
                        "Rate from 0 to 100 how confident you are that the SQL correctly "
                        "answers the question (right tables, filters, aggregations; "
                        "beware of summing mixed currencies). Reply with ONLY this JSON: "
                        '{"confidence": <number>, "reason": "<max 12 words>"}'
                    ),
                }
            ],
            max_tokens=60,
            temperature=0,
        )
        text = response.choices[0].message.content.strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(text)
        return max(0, min(100, int(data["confidence"]))), str(data.get("reason", ""))
    except Exception:
        return None, None  # a missing score should never break the answer


def enrich_products(rows):
    """When the answer rows are products (they carry a style_number), fetch the
    full record for each - image, supplier, price - so the UI can render the same
    rich product cards as the Goods Explorer. Returns None for non-product results
    (aggregates, buyer lists, etc.), which stay as a plain table.
    """
    if not rows or "style_number" not in rows[0]:
        return None
    seen, ordered = set(), []  # keep the query's own order, drop dupes/blanks
    for r in rows:
        sn = r.get("style_number")
        if sn and sn not in seen:
            seen.add(sn)
            ordered.append(sn)
    if not ordered:
        return None
    found = run_query(
        """
        select fg.*, s.company_name as supplier_name
        from finished_goods fg
        join suppliers s on s.supplier_id = fg.supplier_id
        where fg.style_number = any(%s)
        """,
        [ordered],
        readonly=True,
    )
    by_id = {p["style_number"]: p for p in found}
    return [by_id[sn] for sn in ordered if sn in by_id]


class QueryRequest(BaseModel):
    question: str


@router.post("")
def ask(body: QueryRequest, request: Request):
    """Full pipeline: question -> SQL -> safety check -> execute -> answer.

    Always returns HTTP 200 with a "success" flag so the frontend can still
    show the generated SQL even when a later step fails.
    """
    ip = request.client.host if request.client else "unknown"
    if not rate_limit_ok(ip):
        return {"success": False, "error": "Easy there, speed-racer! Ten questions a minute is the limit - catch your breath and try again."}

    question = body.question.strip()
    if not question:
        return {"success": False, "error": "You have to actually ask something - the data cannot read minds (yet)."}

    # Step 1: Vanna + the LLM write the SQL
    try:
        sql = nl2sql.vn.generate_sql(question, allow_llm_to_see_data=False)
    except Exception as exc:
        return {"success": False, "error": f"Could not generate SQL: {exc}"}

    # Sometimes the model replies with a sentence instead of SQL
    # (e.g. when it thinks it needs to peek at the data) - surface that
    # as the error message instead of pretending it's a query.
    first_word = (sql.strip().split(None, 1) or [""])[0].lower()
    if first_word not in ("select", "with"):
        if FORBIDDEN_WORDS.fullmatch(first_word):
            # the question asked for a write (delete/update/...) - refuse clearly
            return {
                "success": False,
                "sql": sql,
                "error": "Nice try! This data is strictly read-only - happy to spill its secrets, but nobody changes it from here.",
            }
        return {"success": False, "error": sql or "The model returned an empty response."}

    # Step 2: safety gate
    if not is_safe_select(sql):
        return {
            "success": False,
            "sql": sql,
            "error": "Nice try! This data is strictly read-only - happy to spill its secrets, but nobody changes it from here.",
        }

    # Step 3: run it as the read-only user, with an 8 second time limit,
    # fetching one row over the limit so we know whether we truncated
    try:
        rows = run_query(sql, readonly=True, timeout_ms=8000, max_rows=MAX_ROWS + 1)
    except Exception as exc:
        return {"success": False, "sql": sql, "error": f"The database raised an eyebrow at that one: {exc}"}

    truncated = len(rows) > MAX_ROWS
    rows = rows[:MAX_ROWS]

    # Step 4: let the LLM write a short plain-English answer from the rows
    try:
        answer = nl2sql.vn.generate_summary(
            question=question, df=pd.DataFrame(rows[:SUMMARY_ROWS])
        )
    except Exception:
        answer = None  # the result table alone is still useful

    # Step 5: self-check - how well does the SQL match the question?
    confidence, confidence_reason = rate_confidence(question, sql)

    # Step 6: if the rows are products, attach full product records so the
    # frontend can show Explorer-style cards. Best-effort - never break the answer.
    try:
        products = enrich_products(rows)
    except Exception:
        products = None

    return {
        "success": True,
        "question": question,
        "sql": sql,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "answer": answer,
        "confidence": confidence,
        "confidence_reason": confidence_reason,
        "products": products,
    }
