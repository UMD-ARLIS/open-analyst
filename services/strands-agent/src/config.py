"""Validated environment configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    litellm_base_url: str = "http://localhost:4000"
    litellm_api_key: str
    node_api_base_url: str = "http://localhost:5173"

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
