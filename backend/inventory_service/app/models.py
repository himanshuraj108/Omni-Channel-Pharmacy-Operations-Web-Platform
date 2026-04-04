"""
Inventory Service - ORM Models
"""
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey,
    Numeric, Date, Text, JSON, BigInteger, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    products = relationship("Product", back_populates="category")


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100))
    phone = Column(String(20))
    email = Column(String(200))
    gstin = Column(String(20))
    address = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    batches = relationship("Batch", back_populates="supplier")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_sku", "sku"),
        Index("ix_products_name_trgm", "name"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(50), unique=True, nullable=False)
    name = Column(String(300), nullable=False)
    generic_name = Column(String(300))
    manufacturer = Column(String(200))
    category_id = Column(Integer, ForeignKey("categories.id"))
    hsn_code = Column(String(20))
    # Drug schedules: OTC, H, H1, X, G, etc.
    schedule = Column(String(10), default="OTC")
    requires_prescription = Column(Boolean, default=False)
    unit = Column(String(20), default="Strip")  # Strip, Bottle, Vial, Tube
    pack_size = Column(Integer, default=1)       # Units per pack
    mrp = Column(Numeric(10, 2), nullable=False)
    gst_rate = Column(Numeric(5, 2), default=12.0)
    # Low stock threshold (branch-level override possible)
    low_stock_threshold = Column(Integer, default=10)
    reorder_quantity = Column(Integer, default=50)
    description = Column(Text)
    image_url = Column(String(500))
    barcode = Column(String(100), unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="products")
    batches = relationship("Batch", back_populates="product")
    stock_ledger = relationship("StockLedger", back_populates="product")
    stock_transfers = relationship("StockTransfer", back_populates="product")


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = (
        Index("ix_batches_product_branch", "product_id", "branch_id"),
        Index("ix_batches_expiry", "expiry_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_no = Column(String(100), nullable=False)
    expiry_date = Column(Date, nullable=False)
    manufacture_date = Column(Date)
    quantity_received = Column(Integer, nullable=False)
    quantity_available = Column(Integer, nullable=False)
    purchase_price = Column(Numeric(10, 2))
    selling_price = Column(Numeric(10, 2))
    branch_id = Column(Integer, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    location_code = Column(String(50))   # Shelf/rack location
    is_active = Column(Boolean, default=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    product = relationship("Product", back_populates="batches")
    supplier = relationship("Supplier", back_populates="batches")
    stock_ledger = relationship("StockLedger", back_populates="batch")

    @property
    def expiry_risk(self) -> str:
        days = (self.expiry_date - date.today()).days
        if days < 0:
            return "EXPIRED"
        elif days < 30:
            return "CRITICAL"
        elif days < 90:
            return "WARNING"
        elif days < 180:
            return "WATCH"
        return "SAFE"

    @property
    def days_to_expiry(self) -> int:
        return (self.expiry_date - date.today()).days


class StockLedger(Base):
    """Immutable append-only stock movement log"""
    __tablename__ = "stock_ledger"
    __table_args__ = (
        Index("ix_sl_branch_product", "branch_id", "product_id"),
        Index("ix_sl_performed_at", "performed_at"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    branch_id = Column(Integer, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"))
    transaction_type = Column(String(30), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    reference_id = Column(UUID(as_uuid=True))
    reference_type = Column(String(50))
    notes = Column(Text)
    performed_by = Column(UUID(as_uuid=True), nullable=False)
    performed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="stock_ledger")
    batch = relationship("Batch", back_populates="stock_ledger")


class StockTransfer(Base):
    """Inter-branch stock transfers and purchase orders"""
    __tablename__ = "stock_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_ref = Column(String(20), unique=True, nullable=False)
    from_branch_id = Column(Integer, nullable=False)
    to_branch_id = Column(Integer, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    estimated_value = Column(Numeric(10, 2), default=0)
    status = Column(String(20), default="PENDING") # PENDING, APPROVED, IN_TRANSIT, COMPLETED, REJECTED
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="stock_transfers")


class BranchProductConfig(Base):
    """Branch-level overrides for low-stock thresholds and reorder quantities"""
    __tablename__ = "branch_product_config"

    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    low_stock_threshold = Column(Integer)
    reorder_quantity = Column(Integer)
    is_stocked = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
