"""
Reporting Service - Real DB Aggregation
Reads from billing_db and inventory_db via direct SQL connections
"""
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from typing import Optional
from datetime import date, timedelta
import logging
import os

logger = logging.getLogger(__name__)

BILLING_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://pharma_admin:changeme_in_production@postgres:5432/pharma_billing_db"
)
INVENTORY_DB_URL = BILLING_DB_URL.replace("pharma_billing_db", "pharma_inventory_db")

billing_engine = create_async_engine(BILLING_DB_URL, pool_pre_ping=True)
inventory_engine = create_async_engine(INVENTORY_DB_URL, pool_pre_ping=True)

BillingSession = async_sessionmaker(billing_engine, class_=AsyncSession, expire_on_commit=False)
InventorySession = async_sessionmaker(inventory_engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Reporting Service...")
    yield


app = FastAPI(
    title="Pharmacy Reporting Service",
    description="BI Dashboards, KPI Reports & Export Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Sales Summary ────────────────────────────────────────────────────────────

@app.get("/api/v1/reports/sales/summary")
async def sales_summary(
    branch_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    period: str = Query("month", enum=["day", "week", "month", "quarter", "year"]),
):
    end = to_date or date.today()
    start = from_date or (end - timedelta(days=30))

    async with BillingSession() as session:
        try:
            # Total revenue KPIs
            branch_filter = "AND branch_id = :branch_id" if branch_id else ""
            kpi_q = text(f"""
                SELECT
                    COALESCE(SUM(grand_total), 0) as total_revenue,
                    COUNT(*) as total_orders,
                    COALESCE(AVG(grand_total), 0) as avg_order_value,
                    COALESCE(SUM(gst_total), 0) as total_gst,
                    COALESCE(SUM(cgst_total), 0) as cgst,
                    COALESCE(SUM(sgst_total), 0) as sgst
                FROM sales_orders
                WHERE status = 'COMPLETED'
                AND DATE(created_at) BETWEEN :start AND :end
                {branch_filter}
            """)
            params = {"start": start, "end": end}
            if branch_id:
                params["branch_id"] = branch_id
            result = await session.execute(kpi_q, params)
            row = result.fetchone()

            kpis = {
                "total_revenue": float(row.total_revenue or 0),
                "total_orders": int(row.total_orders or 0),
                "avg_order_value": float(row.avg_order_value or 0),
                "total_gst_collected": float(row.total_gst or 0),
                "cgst": float(row.cgst or 0),
                "sgst": float(row.sgst or 0),
            }

            # Daily trend
            trend_q = text(f"""
                SELECT
                    DATE(created_at) as day,
                    COALESCE(SUM(grand_total), 0) as revenue,
                    COUNT(*) as orders
                FROM sales_orders
                WHERE status = 'COMPLETED'
                AND DATE(created_at) BETWEEN :start AND :end
                {branch_filter}
                GROUP BY DATE(created_at)
                ORDER BY day
            """)
            trend_result = await session.execute(trend_q, params)
            trend_rows = trend_result.fetchall()
            trend = [{"date": str(r.day), "revenue": float(r.revenue), "orders": int(r.orders)} for r in trend_rows]

            # Payment mode breakdown
            mode_q = text(f"""
                SELECT payment_mode,
                    COALESCE(SUM(grand_total), 0) as revenue,
                    COUNT(*) as count
                FROM sales_orders
                WHERE status = 'COMPLETED'
                AND DATE(created_at) BETWEEN :start AND :end
                {branch_filter}
                GROUP BY payment_mode
            """)
            mode_result = await session.execute(mode_q, params)
            mode_rows = mode_result.fetchall()
            total_rev = float(row.total_revenue or 1)
            by_payment_mode = {
                r.payment_mode: {
                    "revenue": float(r.revenue),
                    "pct": round(float(r.revenue) / total_rev * 100, 1) if total_rev else 0,
                }
                for r in mode_rows
            }

            return {
                "period": {"from": str(start), "to": str(end)},
                "kpis": kpis,
                "trend": trend,
                "by_payment_mode": by_payment_mode,
            }
        except Exception as e:
            logger.error(f"Sales summary error: {e}")
            return {
                "period": {"from": str(start), "to": str(end)},
                "kpis": {"total_revenue": 0, "total_orders": 0, "avg_order_value": 0,
                         "total_gst_collected": 0, "cgst": 0, "sgst": 0},
                "trend": [],
                "by_payment_mode": {},
                "note": "No data yet — start creating orders to see live reports"
            }


# ─── Branch Performance ───────────────────────────────────────────────────────

@app.get("/api/v1/reports/branches/performance")
async def branch_performance(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(10, ge=1, le=50),
):
    end = to_date or date.today()
    start = from_date or (end - timedelta(days=30))

    async with BillingSession() as session:
        try:
            q = text("""
                SELECT
                    branch_id,
                    COALESCE(SUM(grand_total), 0) as revenue,
                    COUNT(*) as orders,
                    COALESCE(AVG(grand_total), 0) as avg_ticket
                FROM sales_orders
                WHERE status = 'COMPLETED'
                AND DATE(created_at) BETWEEN :start AND :end
                GROUP BY branch_id
                ORDER BY revenue DESC
                LIMIT :limit
            """)
            result = await session.execute(q, {"start": start, "end": end, "limit": limit})
            rows = result.fetchall()

            total_revenue_q = text("""
                SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as total_orders
                FROM sales_orders WHERE status = 'COMPLETED'
                AND DATE(created_at) BETWEEN :start AND :end
            """)
            t_result = await session.execute(total_revenue_q, {"start": start, "end": end})
            t_row = t_result.fetchone()

            branches = [
                {
                    "branch_id": r.branch_id,
                    "branch_code": f"BRN{r.branch_id:03d}",
                    "branch_name": f"Branch {r.branch_id}",
                    "revenue": float(r.revenue),
                    "orders": int(r.orders),
                    "avg_ticket": float(r.avg_ticket),
                }
                for r in rows
            ]

            return {
                "branches": branches,
                "network_totals": {
                    "total_revenue": float(t_row.total or 0),
                    "total_orders": int(t_row.total_orders or 0),
                    "active_branches": len(branches),
                },
                "period": {"from": str(start), "to": str(end)},
            }
        except Exception as e:
            logger.error(f"Branch performance error: {e}")
            return {"branches": [], "network_totals": {"total_revenue": 0, "total_orders": 0, "active_branches": 0}}


# ─── Stock Ageing ─────────────────────────────────────────────────────────────

@app.get("/api/v1/reports/stock/ageing/{branch_id}")
async def stock_ageing(branch_id: int):
    from datetime import datetime
    async with InventorySession() as session:
        try:
            q = text("""
                SELECT
                    b.expiry_date,
                    b.quantity_available,
                    b.selling_price,
                    p.name as product_name,
                    p.sku,
                    b.received_at
                FROM batches b
                JOIN products p ON b.product_id = p.id
                WHERE b.branch_id = :branch_id AND b.is_active = true AND b.quantity_available > 0
            """)
            result = await session.execute(q, {"branch_id": branch_id})
            rows = result.fetchall()

            today = date.today()
            buckets = {"0–30 days": 0, "31–90 days": 0, "91–180 days": 0, ">180 days": 0, "Expired": 0}
            values = {"0–30 days": 0, "31–90 days": 0, "91–180 days": 0, ">180 days": 0, "Expired": 0}

            for r in rows:
                days = (r.expiry_date - today).days
                val = float(r.quantity_available or 0) * float(r.selling_price or 0)
                if days < 0:
                    buckets["Expired"] += r.quantity_available
                    values["Expired"] += val
                elif days <= 30:
                    buckets["0–30 days"] += r.quantity_available
                    values["0–30 days"] += val
                elif days <= 90:
                    buckets["31–90 days"] += r.quantity_available
                    values["31–90 days"] += val
                elif days <= 180:
                    buckets["91–180 days"] += r.quantity_available
                    values["91–180 days"] += val
                else:
                    buckets[">180 days"] += r.quantity_available
                    values[">180 days"] += val

            total_qty = sum(buckets.values()) or 1
            ageing = [
                {"range": k, "quantity": v, "value": round(values[k], 2), "pct": round(v / total_qty * 100, 1)}
                for k, v in buckets.items()
            ]

            return {
                "branch_id": branch_id,
                "generated_at": datetime.utcnow().isoformat(),
                "ageing_buckets": ageing,
            }
        except Exception as e:
            logger.error(f"Stock ageing error: {e}")
            return {"branch_id": branch_id, "ageing_buckets": [], "note": "No stock data yet"}


# ─── Export ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/reports/export/{report_type}")
async def export_report(report_type: str, branch_id: Optional[int] = None):
    async with BillingSession() as session:
        try:
            q = text("""
                SELECT order_no, branch_id, customer_name, grand_total, payment_mode, status, created_at
                FROM sales_orders WHERE status = 'COMPLETED'
                ORDER BY created_at DESC LIMIT 1000
            """)
            result = await session.execute(q)
            rows = result.fetchall()
            csv = "Order No,Branch,Customer,Total,Payment,Status,Date\n"
            for r in rows:
                csv += f"{r.order_no},{r.branch_id},{r.customer_name or 'Walk-in'},{r.grand_total},{r.payment_mode},{r.status},{r.created_at}\n"
        except Exception:
            csv = "Order No,Branch,Customer,Total,Payment,Status,Date\n"

    return Response(
        content=csv.encode(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{report_type}_{date.today()}.csv"'},
    )


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "reporting-service"}
