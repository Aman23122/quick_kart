from __future__ import annotations
from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.database import get_db
from app.models import DraftPO
from app.services.po_scheduler import get_next_run_times, _create_draft
from app.utils.time_utils import format_ts

router = APIRouter(prefix="/api/po", tags=["PO Scheduler"])


class DraftPOUpdate(BaseModel):
    line_items: Optional[list] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@router.get("/drafts")
def list_drafts(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 20,
):
    q = db.query(DraftPO)
    if status:
        q = q.filter(DraftPO.status == status)
    total = q.count()
    rows = q.order_by(desc(DraftPO.created_at)).offset(skip).limit(limit).all()

    return {
        "total": total,
        "data": [
            {
                "draft_id": d.draft_id,
                "po_type": d.po_type,
                "slot_label": d.slot_label,
                "status": d.status,
                "grace_starts_at": format_ts(d.grace_starts_at),
                "scheduled_fire_at": format_ts(d.scheduled_fire_at),
                "line_items": d.line_items or [],
                "notes": d.notes,
                "created_at": format_ts(d.created_at),
            }
            for d in rows
        ],
    }


@router.patch("/draft/{draft_id}")
def update_draft(draft_id: str, payload: DraftPOUpdate, db: Session = Depends(get_db)):
    draft = db.get(DraftPO, draft_id)
    if not draft:
        raise HTTPException(404, "Draft PO not found")
    if draft.status not in ("draft",):
        raise HTTPException(400, f"Cannot edit draft with status '{draft.status}'")

    if payload.line_items is not None:
        draft.line_items = payload.line_items
    if payload.notes is not None:
        draft.notes = payload.notes
    if payload.status is not None:
        if payload.status not in ("draft", "overridden"):
            raise HTTPException(400, "Status must be 'draft' or 'overridden'")
        draft.status = payload.status

    db.commit()
    return {"status": "updated", "draft_id": draft_id}


@router.post("/trigger")
def manual_trigger(
    po_type: str = Query(...),
    slot_label: str = Query(...),
):
    _create_draft(po_type=po_type, slot_label=slot_label, fire_in_minutes=10)
    return {"status": "draft_created", "po_type": po_type, "slot_label": slot_label}


@router.get("/schedule")
def get_schedule():
    return {"jobs": get_next_run_times()}
