from __future__ import annotations

from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8081)
    litellm_base_url: str = Field(default="http://localhost:4000", alias="LITELLM_BASE_URL")
    litellm_api_key: str = Field(default="", alias="LITELLM_API_KEY")
    default_chat_model: str = Field(default="gpt-4.1-mini", alias="LITELLM_CHAT_MODEL")
    request_timeout_seconds: float = Field(default=120.0)
    langsmith_tracing: bool = Field(default=True, alias="LANGSMITH_TRACING")
    otel_service_name: str = Field(default="open-analyst-langgraph-runtime", alias="OTEL_SERVICE_NAME")
    otel_exporter_otlp_endpoint: str | None = Field(default=None, alias="OTEL_EXPORTER_OTLP_ENDPOINT")

    @cached_property
    def chat_model_kwargs(self) -> dict[str, object]:
        return {
            "model": self.default_chat_model,
            "base_url": self.litellm_base_url,
            "api_key": self.litellm_api_key or "unused",
            "timeout": self.request_timeout_seconds,
        }


settings = RuntimeSettings()
