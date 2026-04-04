"""
AI Service - Configuration
"""
from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    # Database
    AI_DB_URL: str = "postgresql+asyncpg://pharma_admin:Rahul663456@postgres:5432/pharma_billing_db"
    INVENTORY_DB_URL: str = "postgresql+asyncpg://pharma_admin:Rahul663456@postgres:5432/pharma_inventory_db"
    BILLING_DB_URL: str = "postgresql+asyncpg://pharma_admin:Rahul663456@postgres:5432/pharma_billing_db"

    # AI Provider
    AI_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    AI_MAX_QUERY_ROWS: int = 1000
    AI_ENABLE_PII_MASKING: bool = True

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost", "https://localhost", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def active_api_key(self) -> str:
        return self.GROQ_API_KEY if self.AI_PROVIDER == "groq" else self.OPENAI_API_KEY

    @property
    def active_model(self) -> str:
        return self.GROQ_MODEL if self.AI_PROVIDER == "groq" else self.OPENAI_MODEL

    @property
    def active_base_url(self) -> str | None:
        return self.GROQ_BASE_URL if self.AI_PROVIDER == "groq" else None

settings = Settings()
