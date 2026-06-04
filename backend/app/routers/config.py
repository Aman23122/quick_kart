from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import SystemConfig
from app.utils.time_utils import format_ts

router = APIRouter(prefix="/api/config", tags=["Config"])


class ConfigUpdate(BaseModel):
    config_value: str


@router.get("")
def list_config(db: Session = Depends(get_db)):
    rows = db.query(SystemConfig).all()
    return {
        "data": [
            {
                "config_key": r.config_key,
                "config_value": r.config_value,
                "description": r.description,
                "updated_at": format_ts(r.updated_at),
            }
            for r in rows
        ]
    }


@router.put("/{config_key}")
def update_config(config_key: str, payload: ConfigUpdate, db: Session = Depends(get_db)):
    row = db.get(SystemConfig, config_key)
    if not row:
        raise HTTPException(404, f"Config key '{config_key}' not found")
    row.config_value = payload.config_value
    db.commit()
    return {"status": "updated", "config_key": config_key, "config_value": payload.config_value}
