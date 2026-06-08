from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Vendor

router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


@router.get("/list")
def list_vendors(db: Session = Depends(get_db)):
    vendors = (
        db.query(Vendor)
        .filter(Vendor.is_active == True)
        .order_by(Vendor.name)
        .all()
    )
    return [
        {"vendor_id": v.vendor_id, "name": v.name, "contact_name": v.contact_name}
        for v in vendors
    ]
