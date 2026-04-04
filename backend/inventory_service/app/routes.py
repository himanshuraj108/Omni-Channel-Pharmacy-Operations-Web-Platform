"""
Inventory Service - Full CRUD Routes
Products, Batches, Stock Ledger, Low Stock, Expiry Risk
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date
import uuid

from app.database import get_db
from app.models import Product, Batch, StockLedger, Category, Supplier, BranchProductConfig

products_router = APIRouter()
batches_router = APIRouter()
stock_router = APIRouter()
transfers_router = APIRouter()


# ─── Category helpers ────────────────────────────────────────────────────────

@products_router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.is_active == True))
    cats = result.scalars().all()
    return [{"id": c.id, "name": c.name} for c in cats]


# ─── Products ────────────────────────────────────────────────────────────────

@products_router.get("")
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    schedule: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
):
    q = select(Product).options(selectinload(Product.category))
    if is_active is not None:
        q = q.where(Product.is_active == is_active)
    if search:
        q = q.where(or_(
            Product.name.ilike(f"%{search}%"),
            Product.sku.ilike(f"%{search}%"),
            Product.generic_name.ilike(f"%{search}%"),
        ))
    if category_id:
        q = q.where(Product.category_id == category_id)
    if schedule:
        q = q.where(Product.schedule == schedule)

    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(Product.name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    products = result.scalars().all()

    return {
        "items": [_product_dict(p) for p in products],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@products_router.get("/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).options(selectinload(Product.category))
        .where(Product.id == uuid.UUID(product_id))
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    return _product_dict(p)


@products_router.post("", status_code=201)
async def create_product(data: dict, db: AsyncSession = Depends(get_db)):
    # Generate SKU if not provided
    sku = data.get("sku") or f"SKU-{str(uuid.uuid4())[:8].upper()}"
    p = Product(
        sku=sku,
        name=data["name"],
        generic_name=data.get("generic_name"),
        manufacturer=data.get("manufacturer"),
        category_id=data.get("category_id"),
        hsn_code=data.get("hsn_code"),
        schedule=data.get("schedule", "OTC"),
        requires_prescription=data.get("requires_prescription", False),
        unit=data.get("unit", "Strip"),
        pack_size=data.get("pack_size", 1),
        mrp=data["mrp"],
        gst_rate=data.get("gst_rate", 12.0),
        low_stock_threshold=data.get("low_stock_threshold", 10),
        reorder_quantity=data.get("reorder_quantity", 50),
        description=data.get("description"),
        barcode=data.get("barcode"),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


@products_router.patch("/{product_id}")
async def update_product(product_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == uuid.UUID(product_id)))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    allowed = ["name", "generic_name", "manufacturer", "mrp", "gst_rate",
               "low_stock_threshold", "reorder_quantity", "schedule", "is_active",
               "description", "unit", "pack_size"]
    for k in allowed:
        if k in data:
            setattr(p, k, data[k])
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


def _product_dict(p: Product):
    return {
        "id": str(p.id),
        "sku": p.sku,
        "name": p.name,
        "generic_name": p.generic_name,
        "manufacturer": p.manufacturer,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "schedule": p.schedule,
        "requires_prescription": p.requires_prescription,
        "unit": p.unit,
        "pack_size": p.pack_size,
        "mrp": float(p.mrp),
        "gst_rate": float(p.gst_rate),
        "low_stock_threshold": p.low_stock_threshold,
        "reorder_quantity": p.reorder_quantity,
        "description": p.description,
        "barcode": p.barcode,
        "hsn_code": p.hsn_code,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ─── Batches ─────────────────────────────────────────────────────────────────

@batches_router.get("")
async def list_batches(
    branch_id: Optional[int] = None,
    product_id: Optional[str] = None,
    expiry_risk: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Batch).options(selectinload(Batch.product)).where(Batch.is_active == True)
    if branch_id:
        q = q.where(Batch.branch_id == branch_id)
    if product_id:
        q = q.where(Batch.product_id == uuid.UUID(product_id))

    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(Batch.expiry_date).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    batches = result.scalars().all()

    items = [_batch_dict(b) for b in batches]

    # Filter by expiry risk after fetching (property-based)
    if expiry_risk:
        items = [b for b in items if b["expiry_risk"] == expiry_risk]

    return {"items": items, "total": total, "page": page, "per_page": per_page}


@batches_router.post("", status_code=201)
async def create_batch(data: dict, db: AsyncSession = Depends(get_db)):
    # Verify product exists
    prod_result = await db.execute(
        select(Product).where(Product.id == uuid.UUID(data["product_id"]))
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(400, "Product not found")

    b = Batch(
        product_id=uuid.UUID(data["product_id"]),
        batch_no=data["batch_no"],
        expiry_date=date.fromisoformat(data["expiry_date"]),
        manufacture_date=date.fromisoformat(data["manufacture_date"]) if data.get("manufacture_date") else None,
        quantity_received=data["quantity_received"],
        quantity_available=data["quantity_received"],
        purchase_price=data.get("purchase_price"),
        selling_price=data.get("selling_price", product.mrp),
        branch_id=data["branch_id"],
        supplier_id=data.get("supplier_id"),
        location_code=data.get("location_code"),
        created_by=uuid.UUID(data["created_by"]) if data.get("created_by") else None,
    )
    db.add(b)

    # Record in ledger
    ledger = StockLedger(
        branch_id=data["branch_id"],
        product_id=uuid.UUID(data["product_id"]),
        batch_id=b.id,
        transaction_type="PURCHASE_IN",
        quantity_change=data["quantity_received"],
        quantity_before=0,
        quantity_after=data["quantity_received"],
        notes=f"Batch {data['batch_no']} received",
        performed_by=uuid.UUID(data["created_by"]) if data.get("created_by") else uuid.uuid4(),
    )
    db.add(ledger)
    await db.commit()
    await db.refresh(b)
    return _batch_dict(b)


def _batch_dict(b: Batch):
    days = (b.expiry_date - date.today()).days if b.expiry_date else 9999
    if days < 0:
        risk = "EXPIRED"
    elif days < 30:
        risk = "CRITICAL"
    elif days < 90:
        risk = "WARNING"
    elif days < 180:
        risk = "WATCH"
    else:
        risk = "SAFE"
    return {
        "id": str(b.id),
        "product_id": str(b.product_id),
        "product_name": b.product.name if b.product else None,
        "product_sku": b.product.sku if b.product else None,
        "batch_no": b.batch_no,
        "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        "manufacture_date": b.manufacture_date.isoformat() if b.manufacture_date else None,
        "quantity_received": b.quantity_received,
        "quantity_available": b.quantity_available,
        "purchase_price": float(b.purchase_price) if b.purchase_price else None,
        "selling_price": float(b.selling_price) if b.selling_price else None,
        "branch_id": b.branch_id,
        "location_code": b.location_code,
        "expiry_risk": risk,
        "days_to_expiry": days,
        "is_active": b.is_active,
        "received_at": b.received_at.isoformat() if b.received_at else None,
    }


# ─── Stock ────────────────────────────────────────────────────────────────────

@stock_router.get("/branches/{branch_id}")
async def get_branch_stock(
    branch_id: int,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stock per product for a branch"""
    q = (
        select(
            Batch.product_id,
            Product.name,
            Product.sku,
            Product.schedule,
            Product.mrp,
            Product.low_stock_threshold,
            Product.gst_rate,
            Product.unit,
            func.sum(Batch.quantity_available).label("total_stock"),
            func.min(Batch.expiry_date).label("earliest_expiry"),
        )
        .join(Product, Batch.product_id == Product.id)
        .where(Batch.branch_id == branch_id, Batch.is_active == True)
        .group_by(Batch.product_id, Product.name, Product.sku, Product.schedule,
                  Product.mrp, Product.low_stock_threshold, Product.gst_rate, Product.unit)
    )
    if search:
        q = q.where(or_(Product.name.ilike(f"%{search}%"), Product.sku.ilike(f"%{search}%")))

    result = await db.execute(q)
    rows = result.all()

    items = []
    for r in rows:
        days = (r.earliest_expiry - date.today()).days if r.earliest_expiry else 9999
        if days < 0:
            risk = "EXPIRED"
        elif days < 30:
            risk = "CRITICAL"
        elif days < 90:
            risk = "WARNING"
        elif days < 180:
            risk = "WATCH"
        else:
            risk = "SAFE"
        items.append({
            "product_id": str(r.product_id),
            "name": r.name,
            "sku": r.sku,
            "schedule": r.schedule,
            "mrp": float(r.mrp),
            "gst_rate": float(r.gst_rate),
            "unit": r.unit,
            "stock": int(r.total_stock or 0),
            "threshold": r.low_stock_threshold,
            "earliest_expiry": r.earliest_expiry.isoformat() if r.earliest_expiry else None,
            "expiry_risk": risk,
        })

    # Summary stats
    total_sku = len(items)
    low_stock = sum(1 for i in items if i["stock"] <= i["threshold"])
    expiry_critical = sum(1 for i in items if i["expiry_risk"] in ("CRITICAL", "EXPIRED"))
    stock_value = sum(i["mrp"] * i["stock"] for i in items)

    return {
        "branch_id": branch_id,
        "summary": {
            "total_sku": total_sku,
            "low_stock": low_stock,
            "expiry_critical": expiry_critical,
            "stock_value": round(stock_value, 2),
        },
        "items": items,
    }


@stock_router.get("/branches/{branch_id}/low-stock")
async def get_low_stock(branch_id: int, db: AsyncSession = Depends(get_db)):
    q = (
        select(
            Batch.product_id,
            Product.name,
            Product.sku,
            Product.low_stock_threshold,
            func.sum(Batch.quantity_available).label("total_stock"),
        )
        .join(Product, Batch.product_id == Product.id)
        .where(Batch.branch_id == branch_id, Batch.is_active == True)
        .group_by(Batch.product_id, Product.name, Product.sku, Product.low_stock_threshold)
        .having(func.sum(Batch.quantity_available) <= Product.low_stock_threshold)
    )
    result = await db.execute(q)
    rows = result.all()
    return [{"product_id": str(r.product_id), "name": r.name, "sku": r.sku,
             "stock": int(r.total_stock or 0), "threshold": r.low_stock_threshold} for r in rows]


@stock_router.get("/branches/{branch_id}/expiry-risk")
async def get_expiry_risk(branch_id: int, days_ahead: int = 90, db: AsyncSession = Depends(get_db)):
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=days_ahead)
    q = (
        select(Batch)
        .options(selectinload(Batch.product))
        .where(
            Batch.branch_id == branch_id,
            Batch.is_active == True,
            Batch.expiry_date <= cutoff,
            Batch.quantity_available > 0,
        )
        .order_by(Batch.expiry_date)
    )
    result = await db.execute(q)
    batches = result.scalars().all()
    return [_batch_dict(b) for b in batches]


@stock_router.get("/branches/{branch_id}/ledger")
async def get_stock_ledger(
    branch_id: int,
    product_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(StockLedger)
        .options(selectinload(StockLedger.product))
        .where(StockLedger.branch_id == branch_id)
    )
    if product_id:
        q = q.where(StockLedger.product_id == uuid.UUID(product_id))

    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(StockLedger.performed_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    entries = result.scalars().all()

    return {
        "items": [{
            "id": e.id,
            "product_id": str(e.product_id),
            "product_name": e.product.name if e.product else None,
            "transaction_type": e.transaction_type,
            "quantity_change": e.quantity_change,
            "quantity_before": e.quantity_before,
            "quantity_after": e.quantity_after,
            "notes": e.notes,
            "performed_at": e.performed_at.isoformat() if e.performed_at else None,
        } for e in entries],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ─── Suppliers ────────────────────────────────────────────────────────────────

@products_router.get("/suppliers/list")
async def list_suppliers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).where(Supplier.is_active == True))
    suppliers = result.scalars().all()
    return [{"id": s.id, "name": s.name, "phone": s.phone, "email": s.email} for s in suppliers]


# ─── Transfers ───────────────────────────────────────────────────────────────

from app.models import StockTransfer

@transfers_router.get("")
async def list_transfers(
    branch_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockTransfer).options(selectinload(StockTransfer.product))
    if branch_id:
        q = q.where(or_(StockTransfer.from_branch_id == branch_id, StockTransfer.to_branch_id == branch_id))
    
    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar()

    q = q.order_by(StockTransfer.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    transfers = result.scalars().all()

    return {
        "items": [{
            "id": str(t.id),
            "transfer_ref": t.transfer_ref,
            "from_branch_id": t.from_branch_id,
            "to_branch_id": t.to_branch_id,
            "product_id": str(t.product_id),
            "product_name": t.product.name if t.product else None,
            "quantity": t.quantity,
            "estimated_value": float(t.estimated_value or 0),
            "status": t.status,
            "requested_by": str(t.requested_by),
            "created_at": t.created_at.isoformat() if t.created_at else None,
        } for t in transfers],
        "total": total,
        "page": page,
        "per_page": per_page
    }

@transfers_router.post("", status_code=201)
async def create_transfer(data: dict, db: AsyncSession = Depends(get_db)):
    # Calculate estimated value
    prod_result = await db.execute(select(Product).where(Product.id == uuid.UUID(data["product_id"])))
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(400, "Product not found")
        
    transfer_ref = f"TR-{str(uuid.uuid4())[:8].upper()}"
    t = StockTransfer(
        transfer_ref=transfer_ref,
        from_branch_id=data["from_branch_id"],
        to_branch_id=data["to_branch_id"],
        product_id=uuid.UUID(data["product_id"]),
        quantity=data["quantity"],
        estimated_value=float(product.mrp) * data["quantity"],
        status="PENDING",
        requested_by=uuid.UUID(data["requested_by"])
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": str(t.id), "transfer_ref": t.transfer_ref, "status": t.status}

@transfers_router.patch("/{transfer_id}/status")
async def update_transfer_status(transfer_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockTransfer).where(StockTransfer.id == uuid.UUID(transfer_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Transfer not found")
        
    t.status = data["status"]
    if data.get("approved_by"):
        t.approved_by = uuid.UUID(data["approved_by"])
        
    await db.commit()
    return {"id": str(t.id), "status": t.status}
