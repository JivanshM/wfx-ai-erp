"""Natural Language to SQL API - the main AI feature."""

import re
import time
from collections import deque

import pandas as pd
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import nl2sql
from app.db import run_query

router = APIRouter(prefix="/api/query", tags=["ai query"])

# words that must never appear in AI-generated SQL
# ("into" blocks "select ... into new_table", which creates a table)
FORBIDDEN_WORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|into)\b",
    re.IGNORECASE,
)

MAX_ROWS = 200      # never send huge result sets to the browser
SUMMARY_ROWS = 30   # the LLM only needs a sample of rows to write the answer

# Simple rate limit: every question costs real money on OpenRouter,
# so each visitor (IP) gets at most 10 questions per minute.
RATE_LIMIT, RATE_WINDOW = 10, 60
_request_times: dict[str, deque] = {}


def rate_limit_ok(ip: str) -> bool:
    timestamps = _request_times.setdefault(ip, deque())
    now = time.time()
    while timestamps and now - timestamps[0] > RATE_WINDOW:
        timestamps.popleft()
    if len(timestamps) >= RATE_LIMIT:
        return False
    timestamps.append(now)
    return True


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
        return {"success": False, "error": "Too many questions - wait a minute and try again."}

    question = body.question.strip()
    if not question:
        return {"success": False, "error": "Question is empty."}

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
        return {"success": False, "error": sql or "The model returned an empty response."}

    # Step 2: safety gate
    if not is_safe_select(sql):
        return {
            "success": False,
            "sql": sql,
            "error": "Only read-only SELECT queries are allowed.",
        }

    # Step 3: run it as the read-only user, with an 8 second time limit,
    # fetching one row over the limit so we know whether we truncated
    try:
        rows = run_query(sql, readonly=True, timeout_ms=8000, max_rows=MAX_ROWS + 1)
    except Exception as exc:
        return {"success": False, "sql": sql, "error": f"SQL failed to run: {exc}"}

    truncated = len(rows) > MAX_ROWS
    rows = rows[:MAX_ROWS]

    # Step 4: let the LLM write a short plain-English answer from the rows
    try:
        answer = nl2sql.vn.generate_summary(
            question=question, df=pd.DataFrame(rows[:SUMMARY_ROWS])
        )
    except Exception:
        answer = None  # the result table alone is still useful

    return {
        "success": True,
        "question": question,
        "sql": sql,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "answer": answer,
    }
