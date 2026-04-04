"""
Billing Service - ORM Models
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey,
    Numeric, Text, JSON, BigInteger, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"
    __table_args__ = (
        Index("ix_rx_branch_date", "branch_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id = Column(Integer, nullable=False)
    patient_name = Column(String(200))
    patient_age = Column(Integer)
    patient_gender = Column(String(10))
    patient_phone = Column(String(20))     # AES-encrypted at application level
    doctor_name = Column(String(200))
    doctor_reg_no = Column(String(100))
    hospital_clinic = Column(String(200))
    prescription_date = Column(Date)
    image_url = Column(String(500))        # S3 path
    ocr_text = Column(Text)               # Extracted text from prescription image
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True))
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("SalesOrder", back_populates="prescription")


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        Index("ix_orders_branch_date", "branch_id", "created_at"),
        Index("ix_orders_order_no", "order_no"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_no = Column(String(30), unique=True, nullable=False)  # e.g. MUM001-20240315-00123
    branch_id = Column(Integer, nullable=False)
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=True)
    customer_name = Column(String(200))
    customer_phone = Column(String(20))    # AES-encrypted
    customer_gstin = Column(String(20))

    # Financial summary
    subtotal = Column(Numeric(12, 2), nullable=False)         # Sum of line totals before discounts
    discount_amount = Column(Numeric(12, 2), default=0)       # Order-level discount
    discount_reason = Column(String(200))
    taxable_amount = Column(Numeric(12, 2), nullable=False)
    cgst_total = Column(Numeric(12, 2), default=0)
    sgst_total = Column(Numeric(12, 2), default=0)
    igst_total = Column(Numeric(12, 2), default=0)
    gst_total = Column(Numeric(12, 2), default=0)
    grand_total = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0)
    change_returned = Column(Numeric(12, 2), default=0)

    # Payment
    payment_mode = Column(String(20), nullable=False)  # CASH, UPI, CARD, CREDIT, MIXED
    payment_reference = Column(String(100))            # UPI transaction id / card last 4

    # Status
    status = Column(String(20), nullable=False, default="COMPLETED")
    # DRAFT, COMPLETED, CANCELLED, RETURNED, PARTIALLY_RETURNED

    # Receipt / Invoice
    invoice_no = Column(String(30), unique=True)
    invoice_url = Column(String(500))

    # Flags
    has_schedule_h = Column(Boolean, default=False)   # Contains Schedule H drugs
    has_schedule_x = Column(Boolean, default=False)   # Contains Schedule X drugs (narcotics)
    is_return = Column(Boolean, default=False)
    original_order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=True)
    return_reason = Column(Text)

    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="orders")
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")
    returns = relationship("SalesOrder", foreign_keys=[original_order_id])


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(300))            # Snapshot at time of sale
    product_sku = Column(String(50))
    batch_no = Column(String(100))
    expiry_date = Column(Date)
    quantity = Column(Integer, nullable=False)
    quantity_returned = Column(Integer, default=0)
    unit = Column(String(20))
    mrp = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)   # After item-level discount
    discount_pct = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    gst_rate = Column(Numeric(5, 2), default=0)
    hsn_code = Column(String(20))
    cgst_rate = Column(Numeric(5, 2), default=0)
    sgst_rate = Column(Numeric(5, 2), default=0)
    gst_amount = Column(Numeric(10, 2), default=0)
    taxable_amount = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(12, 2), nullable=False)
    schedule = Column(String(10))

    order = relationship("SalesOrder", back_populates="items")


class PaymentTransaction(Base):
    """Handles mixed/split payments (e.g. part cash, part UPI)"""
    __tablename__ = "payment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=False)
    payment_mode = Column(String(20), nullable=False)   # CASH, UPI, CARD, CREDIT
    amount = Column(Numeric(12, 2), nullable=False)
    reference_no = Column(String(100))
    status = Column(String(20), default="SUCCESS")      # SUCCESS, FAILED, PENDING
    processed_at = Column(DateTime, default=datetime.utcnow)
    processed_by = Column(UUID(as_uuid=True))
