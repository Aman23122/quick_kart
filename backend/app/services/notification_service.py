"""In-memory notification queue consumed by the frontend via polling."""
from __future__ import annotations
from collections import deque
from datetime import datetime
from typing import Literal

_queue: deque = deque(maxlen=100)


NotificationType = Literal[
    "low_stock", "wastage_risk", "temp_rejection",
    "dispatch_blocked", "po_draft_ready", "po_sent",
    "inbound_rejected", "info"
]


def push(
    message: str,
    ntype: NotificationType = "info",
    variant_id: str | None = None,
    extra: dict | None = None,
) -> None:
    _queue.appendleft({
        "id": f"{datetime.now().timestamp()}",
        "type": ntype,
        "message": message,
        "variant_id": variant_id,
        "extra": extra or {},
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "read": False,
    })


def get_all() -> list[dict]:
    return list(_queue)


def mark_read(notification_id: str) -> None:
    for n in _queue:
        if n["id"] == notification_id:
            n["read"] = True
            break


def clear() -> None:
    _queue.clear()
