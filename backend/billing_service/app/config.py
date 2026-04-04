"""
Billing Service - Configuration
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql+asyncpg://pharma_admin:changeme_in_production@postgres:5432/pharma_billing_db"
    ALLOWED_ORIGINS: List[str] = ["http://localhost", "https://localhost", "http://localhost:3000"]
    JWT_SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_USE_VAULT"
    JWT_ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
