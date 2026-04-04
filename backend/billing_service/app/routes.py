"""
Billing Service - Full Routes
Create Orders (POS), List Orders, Prescriptions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, date
import uuid
import random
import string

from app.database import get_db
from app.models import SalesOrder, SalesOrderItem, Prescription, PaymentTransaction

orders_router = APIRouter()
prescriptions_router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_order_no(branch_code: str = "GEN") -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{branch_code}-{date.today().strftime('%Y%m%d')}-{suffix}"


def _order_dict(o: SalesOrder) -> dict:
    return {
        "id": str(o.id),
        "order_no": o.order_no,
        "branch_id": o.branch_id,
        "customer_name": o.customer_name,
        "prescription_id": str(o.prescription_id) if o.prescription_id else None,
        "subtotal": float(o.subtotal),
        "discount_amount": float(o.discount_amount or 0),
        "taxable_amount": float(o.taxable_amount),
        "cgst_total": float(o.cgst_total or 0),
        "sgst_total": float(o.sgst_total or 0),
        "gst_total": float(o.gst_total or 0),
        "grand_total": float(o.grand_total),
        "payment_mode": o.payment_mode,
        "status": o.status,
        "has_schedule_h": o.has_schedule_h,
        "items_count": len(o.items) if o.items else 0,
        "items": [_item_dict(i) for i in (o.items or [])],
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


def _item_dict(i: SalesOrderItem) -> dict:
    return {
        "id": str(i.id),
        "product_id": str(i.product_id),
        "product_name": i.product_name,
        "product_sku": i.product_sku,
        "batch_no": i.batch_no,
        "quantity": i.quantity,
        "mrp": float(i.mrp),
        "unit_price": float(i.unit_price),
        "discount_pct": float(i.discount_pct or 0),
        "gst_rate": float(i.gst_rate or 0),
        "gst_amount": float(i.gst_amount or 0),
        "line_total": float(i.line_total),
        "schedule": i.schedule,
    }


# ─── Orders ──────────────────────────────────────────────────────────────────

@orders_router.post("", status_code=201)
async def create_order(data: dict, db: AsyncSession = Depends(get_db)):
    """Create a new sales order (POS checkout)"""
    items_data = data.get("items", [])
    if not items_data:
        raise HTTPException(400, "Order must have at least one item")

    # Calculate totals
    subtotal = sum(float(i["mrp"]) * int(i["quantity"]) for i in items_data)
    discount_pct = float(data.get("discount_pct", 0))
    discount_amount = subtotal * discount_pct / 100
    taxable_amount = subtotal - discount_amount
    gst_total = sum(
        float(i.get("gst_amount", 0)) for i in items_data
    )
    cgst = gst_total / 2
    sgst = gst_total / 2
    grand_total = taxable_amount

    branch_id = data.get("branch_id", 1)
    branch_code = data.get("branch_code", "BRN")

    order = SalesOrder(
        order_no=_generate_order_no(branch_code),
        branch_id=branch_id,
        prescription_id=uuid.UUID(data["prescription_id"]) if data.get("prescription_id") else None,
        customer_name=data.get("customer_name", "Walk-in Patient"),
        customer_phone=data.get("customer_phone"),
        subtotal=subtotal,
        discount_amount=discount_amount,
        discount_reason=data.get("discount_reason"),
        taxable_amount=taxable_amount,
        cgst_total=cgst,
        sgst_total=sgst,
        gst_total=gst_total,
        grand_total=grand_total,
        amount_paid=data.get("amount_paid", grand_total),
        payment_mode=data.get("payment_mode", "CASH"),
        payment_reference=data.get("payment_reference"),
        status="COMPLETED",
        has_schedule_h=any(i.get("schedule") not in ("OTC", None) for i in items_data),
        created_by=uuid.UUID(data["created_by"]) if data.get("created_by") else uuid.uuid4(),
        invoice_no=_generate_order_no(f"INV-{branch_code}"),
    )
    db.add(order)
    await db.flush()  # Get order.id

    for i in items_data:
        line_total = float(i["mrp"]) * int(i["quantity"])
        item = SalesOrderItem(
            order_id=order.id,
            product_id=uuid.UUID(i["product_id"]),
            batch_id=uuid.UUID(i["batch_id"]) if i.get("batch_id") else uuid.uuid4(),
            product_name=i.get("product_name", ""),
            product_sku=i.get("product_sku", ""),
            batch_no=i.get("batch_no", ""),
            quantity=int(i["quantity"]),
            mrp=float(i["mrp"]),
            unit_price=float(i["mrp"]) * (1 - float(i.get("discount_pct", 0)) / 100),
            discount_pct=float(i.get("discount_pct", 0)),
            gst_rate=float(i.get("gst_rate", 0)),
            gst_amount=float(i.get("gst_amount", 0)),
            taxable_amount=line_total,
            line_total=line_total,
            schedule=i.get("schedule", "OTC"),
        )
        db.add(item)

    await db.commit()
    await db.refresh(order)
    await db.refresh(order, ["items"])
    return _order_dict(order)


@orders_router.get("")
async def list_orders(
    branch_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(SalesOrder).options(selectinload(SalesOrder.items))
    if branch_id:
        q = q.where(SalesOrder.branch_id == branch_id)
    if status:
        q = q.where(SalesOrder.status == status)

    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(desc(SalesOrder.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    orders = result.scalars().all()

    # Calculate today's total
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_q = select(func.sum(SalesOrder.grand_total)).where(
        SalesOrder.created_at >= today_start,
        SalesOrder.status == "COMPLETED",
    )
    if branch_id:
        today_q = today_q.where(SalesOrder.branch_id == branch_id)
    today_res = await db.execute(today_q)
    today_total = float(today_res.scalar() or 0)

    return {
        "items": [_order_dict(o) for o in orders],
        "total": total,
        "page": page,
        "per_page": per_page,
        "today_total": today_total,
    }


@orders_router.get("/{order_id}")
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SalesOrder).options(selectinload(SalesOrder.items))
        .where(SalesOrder.id == uuid.UUID(order_id))
    )
    o = result.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    return _order_dict(o)


@orders_router.patch("/{order_id}/cancel")
async def cancel_order(order_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SalesOrder).where(SalesOrder.id == uuid.UUID(order_id)))
    o = result.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    if o.status != "COMPLETED":
        raise HTTPException(400, "Only completed orders can be cancelled")
    o.status = "CANCELLED"
    o.return_reason = data.get("reason", "")
    await db.commit()
    return {"message": "Order cancelled", "order_id": order_id}


# ─── Prescriptions ────────────────────────────────────────────────────────────

@prescriptions_router.get("")
async def list_prescriptions(
    branch_id: Optional[int] = None,
    is_verified: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Prescription)
    if branch_id:
        q = q.where(Prescription.branch_id == branch_id)
    if is_verified is not None:
        q = q.where(Prescription.is_verified == is_verified)

    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(desc(Prescription.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    prescriptions = result.scalars().all()

    return {
        "items": [{
            "id": str(p.id),
            "branch_id": p.branch_id,
            "patient_name": p.patient_name,
            "patient_age": p.patient_age,
            "patient_gender": p.patient_gender,
            "doctor_name": p.doctor_name,
            "doctor_reg_no": p.doctor_reg_no,
            "hospital_clinic": p.hospital_clinic,
            "prescription_date": p.prescription_date.isoformat() if p.prescription_date else None,
            "is_verified": p.is_verified,
            "notes": p.notes,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        } for p in prescriptions],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@prescriptions_router.post("", status_code=201)
async def create_prescription(data: dict, db: AsyncSession = Depends(get_db)):
    p = Prescription(
        branch_id=data["branch_id"],
        patient_name=data.get("patient_name"),
        patient_age=data.get("patient_age"),
        patient_gender=data.get("patient_gender"),
        patient_phone=data.get("patient_phone"),
        doctor_name=data.get("doctor_name"),
        doctor_reg_no=data.get("doctor_reg_no"),
        hospital_clinic=data.get("hospital_clinic"),
        prescription_date=date.fromisoformat(data["prescription_date"]) if data.get("prescription_date") else date.today(),
        notes=data.get("notes"),
        created_by=uuid.UUID(data["created_by"]) if data.get("created_by") else uuid.uuid4(),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"id": str(p.id), "patient_name": p.patient_name, "created_at": p.created_at.isoformat()}
