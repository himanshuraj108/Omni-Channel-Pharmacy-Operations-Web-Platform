"""
Billing Service - Business Logic Layer
GST calculations, order number generation, invoice generation
"""
import re
import uuid
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional


class GSTCalculator:
    """GST-compliant tax calculation for Indian pharmacy billing"""

    GST_BRACKETS = [0, 5, 12, 18, 28]  # Valid GST rates in %

    @staticmethod
    def calculate_line_item(
        mrp: Decimal,
        quantity: int,
        discount_pct: Decimal,
        gst_rate: Decimal,
        is_intra_state: bool = True,
    ) -> Dict[str, Decimal]:
        """
        Returns GST-inclusive line-item breakdown (MRP is inclusive of GST for pharma)
        """
        gross = mrp * quantity
        discount_amount = (gross * discount_pct / 100).quantize(Decimal("0.01"), ROUND_HALF_UP)
        taxable_gross = gross - discount_amount

        # Back-calculate taxable amount from MRP (inclusive of GST)
        gst_multiplier = 1 + gst_rate / 100
        taxable_amount = (taxable_gross / gst_multiplier).quantize(Decimal("0.01"), ROUND_HALF_UP)
        gst_amount = (taxable_gross - taxable_amount).quantize(Decimal("0.01"), ROUND_HALF_UP)

        if is_intra_state:
            cgst = (gst_amount / 2).quantize(Decimal("0.01"), ROUND_HALF_UP)
            sgst = gst_amount - cgst
            igst = Decimal("0.00")
        else:
            cgst = sgst = Decimal("0.00")
            igst = gst_amount

        return {
            "gross": gross,
            "discount_amount": discount_amount,
            "taxable_amount": taxable_amount,
            "cgst_rate": gst_rate / 2 if is_intra_state else Decimal("0"),
            "sgst_rate": gst_rate / 2 if is_intra_state else Decimal("0"),
            "igst_rate": gst_rate if not is_intra_state else Decimal("0"),
            "cgst_amount": cgst,
            "sgst_amount": sgst,
            "igst_amount": igst,
            "gst_amount": gst_amount,
            "line_total": taxable_gross,
        }

    @staticmethod
    def calculate_order_total(items: List[Dict]) -> Dict[str, Decimal]:
        """Aggregate totals across all line items"""
        subtotal = sum(i["gross"] for i in items)
        total_discount = sum(i["discount_amount"] for i in items)
        total_taxable = sum(i["taxable_amount"] for i in items)
        total_cgst = sum(i["cgst_amount"] for i in items)
        total_sgst = sum(i["sgst_amount"] for i in items)
        total_igst = sum(i["igst_amount"] for i in items)
        grand_total = sum(i["line_total"] for i in items)

        return {
            "subtotal": subtotal,
            "discount_amount": total_discount,
            "taxable_amount": total_taxable,
            "cgst_total": total_cgst,
            "sgst_total": total_sgst,
            "igst_total": total_igst,
            "gst_total": total_cgst + total_sgst + total_igst,
            "grand_total": grand_total,
        }


class OrderNumberGenerator:
    """Generate unique, traceable order numbers"""

    @staticmethod
    def generate(branch_code: str) -> str:
        """
        Format: {BRANCH_CODE}-{YYYYMMDD}-{RANDOM_5}
        Example: MUM001-20240315-A3F7K
        """
        today = datetime.utcnow().strftime("%Y%m%d")
        suffix = uuid.uuid4().hex[:5].upper()
        return f"{branch_code.upper()}-{today}-{suffix}"

    @staticmethod
    def generate_invoice_no(branch_code: str, financial_year: str) -> str:
        """
        Format: INV/{branch}/{FY}/{sequential}
        Example: INV/MUM001/2425/00123
        """
        suffix = uuid.uuid4().hex[:5].upper()
        return f"INV/{branch_code.upper()}/{financial_year}/{suffix}"


class DrugScheduleValidator:
    """Validate prescription requirements for scheduled drugs"""

    PRESCRIPTION_REQUIRED = {"H", "H1", "X", "G", "L", "P"}

    @staticmethod
    def requires_prescription(schedule: str) -> bool:
        return schedule.upper() in DrugScheduleValidator.PRESCRIPTION_REQUIRED

    @staticmethod
    def validate_order_items(items: List[Dict], prescription_id: Optional[str]) -> tuple[bool, str]:
        """Check if prescription exists for Rx-required items"""
        for item in items:
            schedule = (item.get("schedule") or "OTC").upper()
            if DrugScheduleValidator.requires_prescription(schedule):
                if not prescription_id:
                    return False, f"Prescription required for Schedule {schedule} drug: {item.get('product_name', '')}"
        return True, "OK"


def get_financial_year() -> str:
    """Return current Indian financial year string e.g. '2425' for FY 2024-25"""
    now = datetime.utcnow()
    if now.month >= 4:
        return f"{str(now.year)[2:]}{str(now.year + 1)[2:]}"
    return f"{str(now.year - 1)[2:]}{str(now.year)[2:]}"
