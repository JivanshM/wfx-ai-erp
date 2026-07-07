"""Tiny in-memory rate limiter, shared by every endpoint that costs money.

Each visitor (IP address) gets at most LIMIT requests per WINDOW seconds.
Good enough for a single-server demo; a real product would use Redis.
"""

import time
from collections import deque

LIMIT, WINDOW = 10, 60
_request_times: dict[str, deque] = {}


def rate_limit_ok(ip: str) -> bool:
    timestamps = _request_times.setdefault(ip, deque())
    now = time.time()
    while timestamps and now - timestamps[0] > WINDOW:
        timestamps.popleft()
    if len(timestamps) >= LIMIT:
        return False
    timestamps.append(now)
    return True
