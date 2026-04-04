"""
AI Service - Conversational Query Engine (Text-to-SQL + Safety Guardrails)
Now wired to real Groq LLM + asyncpg for live database execution.
"""
from __future__ import annotations
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


# ─── Safety Guardrails ────────────────────────────────────────────────────────

ALLOWED_TABLES = {
    "sales_orders", "sales_order_items", "products", "batches",
    "stock_ledger", "branches", "prescriptions", "categories",
    "replenishment_requests", "replenishment_items",
}

BLOCKED_KEYWORDS = {
    "drop", "delete", "truncate", "insert", "update", "alter", "create",
    "grant", "revoke", "execute", "exec", "pg_", "information_schema",
    "users", "user_sessions", "auth_audit_log", "password", "mfa_secret",
    "customer_phone", "patient_phone",
}

MAX_QUERY_ROWS = 1000
QUERY_TIMEOUT_SECONDS = 30


@dataclass
class QueryResult:
    question: str
    answer: str
    data: List[Dict]
    chart_type: str
    sql_executed: Optional[str]
    row_count: int
    execution_time_ms: float
    disclaimer: str
    query_id: str
    generated_at: str


class SQLSafetyValidator:
    @staticmethod
    def validate(sql: str) -> tuple[bool, str]:
        sql_lower = sql.lower().strip()
        if not sql_lower.startswith("select"):
            return False, "Only SELECT queries are allowed"
        words = set(re.findall(r'\b\w+\b', sql_lower))
        blocked = words & BLOCKED_KEYWORDS
        if blocked:
            return False, f"Query contains blocked keywords: {', '.join(blocked)}"
        table_pattern = re.compile(r'\bfrom\s+(\w+)|\bjoin\s+(\w+)', re.IGNORECASE)
        referenced_tables = set()
        for match in table_pattern.finditer(sql_lower):
            t = match.group(1) or match.group(2)
            if t:
                referenced_tables.add(t)
        disallowed = referenced_tables - ALLOWED_TABLES
        if disallowed:
            return False, f"Access denied to tables: {', '.join(disallowed)}"
        if "limit" not in sql_lower:
            return False, "Query must include a LIMIT clause"
        return True, "OK"

    @staticmethod
    def inject_row_limit(sql: str, max_rows: int = MAX_QUERY_ROWS) -> str:
        sql = sql.rstrip(";").rstrip()
        limit_match = re.search(r'\blimit\s+(\d+)', sql, re.IGNORECASE)
        if limit_match:
            current_limit = int(limit_match.group(1))
            if current_limit > max_rows:
                sql = re.sub(r'\blimit\s+\d+', f'LIMIT {max_rows}', sql, flags=re.IGNORECASE)
        else:
            sql += f" LIMIT {max_rows}"
        return sql + ";"


SCHEMA_DESCRIPTION = """
Available tables and their purpose:

- sales_orders: Sales transactions. Columns: id, order_no, branch_id, created_at,
  grand_total, discount_amount, gst_total, payment_mode, status, has_schedule_h.
- sales_order_items: Line items within each order. Columns: order_id, product_id,
  product_name, product_sku, quantity, unit_price, gst_rate, line_total, schedule.
- products: Product master. Columns: id, sku, name, generic_name, manufacturer,
  mrp, gst_rate, schedule, requires_prescription, unit, category_id.
- batches: Product batches. Columns: id, product_id, batch_no, expiry_date,
  quantity_available, branch_id, received_at, low_stock_threshold.
- stock_ledger: Stock movements. Columns: branch_id, product_id, batch_id,
  transaction_type, quantity_change, quantity_after, performed_at.
- branches: Branch master. Columns: id, code, name, city, state, is_pilot, is_active.
- categories: Product categories. Columns: id, name.
- replenishment_requests: Inter-branch transfers. Columns: id, requesting_branch_id,
  fulfilling_branch_id, status, created_at.

IMPORTANT: Always include a LIMIT clause. Only SELECT. Never reference PII columns.
"""


class ConversationalQueryEngine:
    CHART_INTENT_PATTERNS = {
        "line": ["trend", "over time", "monthly", "weekly", "daily", "history"],
        "bar": ["compare", "top", "bottom", "by branch", "by category", "highest", "lowest"],
        "pie": ["distribution", "percentage", "share", "breakdown"],
        "number": ["total", "count", "how many", "what is the", "current"],
    }

    def __init__(self, db_conn=None, openai_client=None):
        self.db = db_conn          # legacy param — not used now
        self.openai = openai_client  # legacy — we build client from config
        self._query_log: List[Dict] = []
        self._ai_client = None

    def _get_ai_client(self):
        """Lazily init OpenAI-compatible client (Groq or OpenAI)"""
        if self._ai_client is not None:
            return self._ai_client
        try:
            from openai import AsyncOpenAI
            from app.config import settings
            if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY:
                self._ai_client = AsyncOpenAI(
                    api_key=settings.GROQ_API_KEY,
                    base_url=settings.GROQ_BASE_URL,
                )
                logger.info("AI Engine: Using Groq LLM")
            elif settings.OPENAI_API_KEY:
                self._ai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                logger.info("AI Engine: Using OpenAI")
            else:
                logger.warning("AI Engine: No API key found — using rule-based SQL")
        except Exception as e:
            logger.error(f"AI client init failed: {e}")
        return self._ai_client

    def _infer_chart_type(self, question: str) -> str:
        q_lower = question.lower()
        for chart_type, keywords in self.CHART_INTENT_PATTERNS.items():
            if any(kw in q_lower for kw in keywords):
                return chart_type
        return "table"

    async def _generate_sql_with_llm(self, question: str) -> str:
        client = self._get_ai_client()
        if not client:
            return self._rule_based_sql(question)
        from app.config import settings
        system_prompt = f"""You are a PostgreSQL SQL generator for a pharmacy operations database.

{SCHEMA_DESCRIPTION}

Rules:
- Generate ONLY a single SELECT statement
- Always include LIMIT (max {MAX_QUERY_ROWS})
- Never reference customer_phone, patient_phone, patient_name, password, mfa_secret
- For date comparisons use NOW() or CURRENT_DATE
- Return ONLY the SQL query, no explanation, no markdown, no code block
"""
        try:
            response = await client.chat.completions.create(
                model=settings.active_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Question: {question}"},
                ],
                temperature=0.1,
                max_tokens=500,
                timeout=20,
            )
            sql = response.choices[0].message.content.strip()
            # Strip any markdown code blocks if present
            sql = re.sub(r'^```\w*\n?', '', sql, flags=re.MULTILINE)
            sql = re.sub(r'\n?```$', '', sql, flags=re.MULTILINE)
            return sql.strip()
        except Exception as e:
            logger.error(f"LLM query generation failed: {e}")
            return self._rule_based_sql(question)

    def _rule_based_sql(self, question: str) -> str:
        q = question.lower()
        if "top" in q and ("branch" in q or "store" in q) and ("sale" in q or "revenue" in q):
            return """SELECT b.name as branch_name, b.city,
                COUNT(so.id) as total_orders,
                COALESCE(SUM(so.grand_total), 0) as total_revenue
                FROM branches b
                LEFT JOIN sales_orders so ON so.branch_id = b.id AND so.status = 'COMPLETED'
                AND so.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY b.id, b.name, b.city
                ORDER BY total_revenue DESC LIMIT 10;"""
        if "expir" in q:
            return """SELECT p.name as product_name, ba.batch_no,
                ba.expiry_date, ba.quantity_available,
                (ba.expiry_date - CURRENT_DATE) as days_to_expiry
                FROM batches ba
                JOIN products p ON ba.product_id = p.id
                WHERE ba.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
                AND ba.quantity_available > 0
                ORDER BY ba.expiry_date LIMIT 50;"""
        if "low stock" in q or ("stock" in q and "low" in q):
            return """SELECT p.name as product_name, p.sku,
                SUM(ba.quantity_available) as current_stock,
                p.low_stock_threshold as threshold
                FROM batches ba
                JOIN products p ON ba.product_id = p.id
                WHERE ba.is_active = TRUE
                GROUP BY p.id, p.name, p.sku, p.low_stock_threshold
                HAVING SUM(ba.quantity_available) <= p.low_stock_threshold
                ORDER BY current_stock ASC LIMIT 50;"""
        if "product" in q and ("top" in q or "best" in q or "sell" in q):
            return """SELECT soi.product_name, soi.product_sku,
                SUM(soi.quantity) as total_sold,
                SUM(soi.line_total) as total_revenue
                FROM sales_order_items soi
                JOIN sales_orders so ON soi.order_id = so.id
                WHERE so.status = 'COMPLETED'
                AND so.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY soi.product_name, soi.product_sku
                ORDER BY total_sold DESC LIMIT 10;"""
        if "category" in q:
            return """SELECT c.name as category, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
                GROUP BY c.id, c.name
                ORDER BY product_count DESC LIMIT 20;"""
        # Default: show recent orders
        return """SELECT order_no, branch_id, grand_total, payment_mode, status, created_at
            FROM sales_orders
            ORDER BY created_at DESC LIMIT 20;"""

    async def query(self, question: str, user_id: str, branch_id: Optional[int] = None) -> QueryResult:
        query_id = str(uuid.uuid4())
        start_time = time.time()

        # 1. Generate SQL via LLM or rules
        raw_sql = await self._generate_sql_with_llm(question)

        # 2. Add branch filter for non-admin users
        if branch_id:
            sql_stripped = raw_sql.rstrip(";").strip()
            if "where" in sql_stripped.lower():
                raw_sql = sql_stripped + f" AND (branch_id = {branch_id} OR requesting_branch_id = {branch_id})"
            else:
                # Only inject if table has branch_id — best-effort
                pass

        # 3. Safety validation
        is_valid, reason = SQLSafetyValidator.validate(raw_sql)
        if not is_valid:
            exec_ms = (time.time() - start_time) * 1000
            return QueryResult(
                question=question, answer=f"⚠️ Query blocked: {reason}", data=[],
                chart_type="table", sql_executed=None, row_count=0,
                execution_time_ms=exec_ms,
                disclaimer="This query was blocked by safety guardrails.",
                query_id=query_id, generated_at=datetime.utcnow().isoformat(),
            )

        # 4. Inject row limit
        safe_sql = SQLSafetyValidator.inject_row_limit(raw_sql)

        # 5. Execute against live DB
        try:
            data = await self._execute_query(safe_sql)
            exec_ms = (time.time() - start_time) * 1000
        except Exception as e:
            exec_ms = (time.time() - start_time) * 1000
            logger.error(f"Query execution error: {e}")
            return QueryResult(
                question=question, answer=f"Query execution failed: {str(e)[:200]}",
                data=[], chart_type="table", sql_executed=None, row_count=0,
                execution_time_ms=exec_ms,
                disclaimer="An error occurred. Please refine your question.",
                query_id=query_id, generated_at=datetime.utcnow().isoformat(),
            )

        chart_type = self._infer_chart_type(question)
        answer = self._summarize_results(question, data)

        return QueryResult(
            question=question, answer=answer, data=data,
            chart_type=chart_type, sql_executed=safe_sql,
            row_count=len(data), execution_time_ms=(time.time() - start_time) * 1000,
            disclaimer="AI-generated insights. Verify critical decisions with source data.",
            query_id=query_id, generated_at=datetime.utcnow().isoformat(),
        )

    async def _execute_query(self, sql: str) -> List[Dict]:
        """Execute validated SQL via asyncpg pool"""
        from app.database import execute_query
        result = await execute_query(sql)
        if result is None:
            # DB not available — return informative message
            return [{"info": "Database not yet connected. Add products and sales to see real data here."}]
        return result

    def _summarize_results(self, question: str, data: List[Dict]) -> str:
        if not data:
            return "No data found for your query. The database may be empty — try adding some products and sales first!"
        if len(data) == 1 and "info" in data[0]:
            return data[0]["info"]
        keys = list(data[0].keys()) if data else []
        return f"Found **{len(data)} records** matching your query. Key fields: {', '.join(keys[:4])}."
