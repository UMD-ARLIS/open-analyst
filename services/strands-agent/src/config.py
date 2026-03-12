"""Validated environment configuration using Pydantic Settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
SERVICE_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    litellm_base_url: str = "http://localhost:4000"
    litellm_api_key: str
    node_api_base_url: str = "http://localhost:5173"
    request_timeout_seconds: int = 60

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=(REPO_ROOT_ENV, SERVICE_ENV),
        extra="ignore",
    )


settings = Settings()
