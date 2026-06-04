from __future__ import annotations
from datetime import datetime, timezone


def format_ts(dt: datetime | None) -> str | None:
    """Return YYYY-MM-DD HH:MM:SS string from a datetime object."""
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def now_ts() -> str:
    """Current local time as YYYY-MM-DD HH:MM:SS string."""
    return format_ts(datetime.now())


def now() -> datetime:
    return datetime.now()
