"""
Auth Service - Configuration (Pydantic Settings)
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    DEBUG: bool = False
    APP_ENV: str = "production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://pharma_user:pharma_pass@localhost:5432/pharma_auth_db"

    # JWT
    JWT_SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_USE_VAULT"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://pharma-ops.in"]

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
