"""FEFO Engine: First Expired, First Out inventory allocation."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import asc
from app.models import Inventory, InventoryTransaction
from app.utils.id_gen import new_id
from app.utils.time_utils import now


@dataclass
class AllocationLine:
    inventory_id: str
    batch_sell_before: str
    qty_allocated: int
    qty_remaining_after: int


@dataclass
class FEFOResult:
    fulfilled: bool
    allocations: list[AllocationLine]
    qty_requested: int
    qty_fulfilled: int
    shortage: int


@dataclass
class PreviewBatch:
    inventory_id: str
    sell_before_date: str
    expiry_date: Optional[str]
    qty_available: int
    qty_to_dispatch: int
    days_until_expiry: Optional[int]
    batch_no: Optional[str]
    temperature_measured: Optional[int]


@dataclass
class FEFOPreview:
    fulfilled: bool
    qty_requested: int
    qty_fulfilled: int
    shortage: int
    batches: list[PreviewBatch] = field(default_factory=list)


def allocate(
    db: Session,
    variant_id: str,
    fulfillment_center_id: str,
    qty_requested: int,
    reference_type: str,
    reference_id: str,
    created_by: str = "system",
) -> FEFOResult:
    """Deduct stock from oldest sell_before_date batches first."""
    batches = (
        db.query(Inventory)
        .filter(
            Inventory.variant_id == variant_id,
            Inventory.fulfillment_center_id == fulfillment_center_id,
            Inventory.qty > 0,
            Inventory.sell_before_date >= date.today(),  # expired batches skip
        )
        .order_by(asc(Inventory.sell_before_date))
        .all()
    )

    remaining = qty_requested
    allocations: list[AllocationLine] = []

    for batch in batches:
        if remaining <= 0:
            break

        deduct = min(batch.qty, remaining)
        qty_before = batch.qty
        batch.qty -= deduct
        remaining -= deduct

        txn = InventoryTransaction(
            transaction_id=new_id(),
            inventory_id=batch.inventory_id,
            variant_id=variant_id,
            fulfillment_center_id=fulfillment_center_id,
            transaction_type="outbound",
            qty_change=-deduct,
            qty_before=qty_before,
            qty_after=batch.qty,
            reference_type=reference_type,
            reference_id=reference_id,
            batch_no=None,
            notes=f"FEFO allocation: {deduct} units from batch expiring {batch.sell_before_date}",
            created_by=created_by,
            created_at=now(),
        )
        db.add(txn)

        allocations.append(AllocationLine(
            inventory_id=batch.inventory_id,
            batch_sell_before=str(batch.sell_before_date),
            qty_allocated=deduct,
            qty_remaining_after=batch.qty,
        ))

    qty_fulfilled = qty_requested - remaining
    return FEFOResult(
        fulfilled=(remaining == 0),
        allocations=allocations,
        qty_requested=qty_requested,
        qty_fulfilled=qty_fulfilled,
        shortage=remaining,
    )


def preview_allocate(
    db: Session,
    variant_id: str,
    fulfillment_center_id: str,
    qty_requested: int,
) -> FEFOPreview:
    """Read-only FEFO simulation — no DB writes, no inventory deduction."""
    from app.models import ProcurementItem

    batches = (
        db.query(Inventory)
        .filter(
            Inventory.variant_id == variant_id,
            Inventory.fulfillment_center_id == fulfillment_center_id,
            Inventory.qty > 0,
            Inventory.sell_before_date >= date.today(),
        )
        .order_by(asc(Inventory.sell_before_date))
        .all()
    )

    remaining = qty_requested
    preview_batches: list[PreviewBatch] = []

    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.qty, remaining)
        remaining -= take

        days_left = (batch.sell_before_date - date.today()).days if batch.sell_before_date else None

        proc_item = (
            db.query(ProcurementItem)
            .filter(
                ProcurementItem.variant_id == variant_id,
                ProcurementItem.sell_before_date == batch.sell_before_date,
            )
            .order_by(ProcurementItem.created_at.asc())
            .first()
        )

        preview_batches.append(PreviewBatch(
            inventory_id=batch.inventory_id,
            sell_before_date=str(batch.sell_before_date),
            expiry_date=str(batch.expiry_date) if batch.expiry_date else None,
            qty_available=batch.qty,
            qty_to_dispatch=take,
            days_until_expiry=days_left,
            batch_no=proc_item.batch_no if proc_item else None,
            temperature_measured=proc_item.temperature_measured if proc_item else None,
        ))

    qty_fulfilled = qty_requested - remaining
    return FEFOPreview(
        fulfilled=(remaining == 0),
        qty_requested=qty_requested,
        qty_fulfilled=qty_fulfilled,
        shortage=remaining,
        batches=preview_batches,
    )
