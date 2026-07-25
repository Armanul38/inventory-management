import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/inventory")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-change-in-production-1234567890")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        case_sensitive = True

settings = Settings()
