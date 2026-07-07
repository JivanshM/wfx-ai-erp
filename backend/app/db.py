"""Small database helper used by every API route."""

import psycopg2
import psycopg2.extras

from app.config import DATABASE_URL


def run_query(sql, params=None):
    """Runs a SELECT query and returns the rows as a list of dicts.

    A fresh connection per request keeps things simple and safe:
    no shared state, and the connection always gets closed.
    """
    conn = psycopg2.connect(DATABASE_URL)
    try:
        # RealDictCursor makes each row a dict like {"column": value}
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()
    finally:
        conn.close()
