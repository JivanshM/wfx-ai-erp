"""Small database helper used by every API route."""

import psycopg2
import psycopg2.extras

from app.config import DATABASE_URL, READONLY_DATABASE_URL


def run_query(sql, params=None, readonly=False, timeout_ms=None, max_rows=None):
    """Runs a SELECT query and returns the rows as a list of dicts.

    readonly=True   -> connect as the read-only user AND mark the whole
                       session read-only (for AI-generated SQL)
    timeout_ms=8000 -> the database kills the query if it runs longer
    max_rows=200    -> fetch at most this many rows (protects memory)

    A fresh connection per request keeps things simple and safe:
    no shared state, and the connection always gets closed.
    """
    conn = psycopg2.connect(READONLY_DATABASE_URL if readonly else DATABASE_URL)
    try:
        if readonly:
            # even if the connection string were wrong, this session
            # now refuses every write - second lock on the same door
            conn.set_session(readonly=True)
        # RealDictCursor makes each row a dict like {"column": value}
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if timeout_ms:
                cur.execute("set statement_timeout = %s", (timeout_ms,))
            cur.execute(sql, params or [])
            return cur.fetchmany(max_rows) if max_rows else cur.fetchall()
    finally:
        conn.close()
