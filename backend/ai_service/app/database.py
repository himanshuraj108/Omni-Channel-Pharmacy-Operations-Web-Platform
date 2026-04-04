"""
AI Service - Database Connection using asyncpg directly (for raw SQL execution by query engine)
"""
import asyncpg
import logging
from app.config import settings

logger = logging.getLogger(__name__)

_inventory_pool = None
_billing_pool = None

async def get_pools():
    """Get or create asyncpg connection pools for both inventory and billing"""
    global _inventory_pool, _billing_pool
    
    async def create_pool(url_str):
        try:
            url = url_str.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
            user_pass, rest = url.split("@", 1)
            username, password = user_pass.split(":", 1)
            host_port, database = rest.split("/", 1)
            if ":" in host_port:
                host, port = host_port.split(":", 1)
                port = int(port)
            else:
                host = host_port
                port = 5432
            return await asyncpg.create_pool(
                host=host, port=port, user=username, password=password, database=database,
                min_size=1, max_size=5, command_timeout=30
            )
        except Exception as e:
            logger.error(f"Pool creation failed for {url_str}: {e}")
            return None

    if _billing_pool is None:
        _billing_pool = await create_pool(settings.BILLING_DB_URL)
        logger.info("AI Service: Billing DB pool created")
        
    if _inventory_pool is None:
        _inventory_pool = await create_pool(settings.INVENTORY_DB_URL)
        logger.info("AI Service: Inventory DB pool created")

    return _inventory_pool, _billing_pool


async def execute_query(sql: str):
    """Execute a validated SELECT query on the appropriate database"""
    inventory_pool, billing_pool = await get_pools()
    
    # Smart router: decide which DB to use based on table names
    sql_lower = sql.lower()
    billing_tables = ["sales_orders", "sales_order_items", "payment_transactions", "prescriptions"]
    inventory_tables = ["products", "batches", "categories", "stock_ledger", "branches", "replenishment"]
    
    uses_billing = any(t in sql_lower for t in billing_tables)
    uses_inventory = any(t in sql_lower for t in inventory_tables)
    
    # Default to billing if unsure, unless it clearly uses only inventory tables
    target_pool = inventory_pool if (uses_inventory and not uses_billing) else billing_pool
    
    if target_pool is None:
        return None
        
    try:
        async with target_pool.acquire() as conn:
            await conn.execute(f"SET statement_timeout = '30000'")
            rows = await conn.fetch(sql)
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"SQL execution failed: {e}")
        raise e


async def close_pool():
    global _inventory_pool, _billing_pool
    if _inventory_pool:
        await _inventory_pool.close()
        _inventory_pool = None
    if _billing_pool:
        await _billing_pool.close()
        _billing_pool = None
