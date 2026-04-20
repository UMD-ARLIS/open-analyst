from __future__ import annotations

from functools import cached_property
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8081)
    open_analyst_data_dir: str = Field(default="", alias="OPEN_ANALYST_DATA_DIR")
    open_analyst_web_url: str = Field(default="", alias="OPEN_ANALYST_WEB_URL")
    open_analyst_web_internal_url: str = Field(default="", alias="OPEN_ANALYST_WEB_INTERNAL_URL")
    open_analyst_web_port: int = Field(default=5173, alias="OPEN_ANALYST_WEB_PORT")
    open_analyst_internal_api_key: str = Field(
        default="",
        alias="OPEN_ANALYST_INTERNAL_API_KEY",
    )
    project_workspaces_root: str = Field(default="", alias="PROJECT_WORKSPACES_ROOT")
    artifact_storage_backend: str = Field(default="local", alias="ARTIFACT_STORAGE_BACKEND")
    artifact_local_dir: str = Field(default="", alias="ARTIFACT_LOCAL_DIR")
    artifact_s3_bucket: str = Field(default="", alias="ARTIFACT_S3_BUCKET")
    artifact_s3_region: str = Field(default="us-east-1", alias="ARTIFACT_S3_REGION")
    artifact_s3_prefix: str = Field(default="open-analyst-vnext", alias="ARTIFACT_S3_PREFIX")
    artifact_s3_endpoint: str = Field(default="", alias="ARTIFACT_S3_ENDPOINT")
    cors_allowed_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ALLOWED_ORIGINS",
    )
    cors_allowed_origin_regex: str = Field(
        default=r"https?://[^/]+:5173$",
        alias="CORS_ALLOWED_ORIGIN_REGEX",
    )
    litellm_base_url: str = Field(default="http://localhost:4000", alias="LITELLM_BASE_URL")
    litellm_api_key: str = Field(default="", alias="LITELLM_API_KEY")
    default_chat_model: str = Field(default="gpt-4.1-mini", alias="LITELLM_CHAT_MODEL")
    fallback_chat_models_raw: str = Field(default="", alias="LITELLM_FALLBACK_CHAT_MODELS")
    litellm_embedding_model: str = Field(default="", alias="LITELLM_EMBEDDING_MODEL")
    chat_retry_max_retries: int = Field(default=8, alias="CHAT_RETRY_MAX_RETRIES")
    chat_retry_initial_delay_seconds: float = Field(default=2.0, alias="CHAT_RETRY_INITIAL_DELAY_SECONDS")
    chat_retry_backoff_factor: float = Field(default=2.0, alias="CHAT_RETRY_BACKOFF_FACTOR")
    chat_retry_max_delay_seconds: float = Field(default=45.0, alias="CHAT_RETRY_MAX_DELAY_SECONDS")
    chat_rate_limit_rps: float = Field(default=0.0, alias="CHAT_RATE_LIMIT_RPS")
    chat_rate_limit_check_every_seconds: float = Field(default=0.1, alias="CHAT_RATE_LIMIT_CHECK_EVERY_SECONDS")
    chat_rate_limit_max_bucket_size: int = Field(default=0, alias="CHAT_RATE_LIMIT_MAX_BUCKET_SIZE")
    chat_max_concurrent_requests: int = Field(default=0, alias="CHAT_MAX_CONCURRENT_REQUESTS")
    database_url: str = Field(default="", alias="DATABASE_URL")
    analyst_mcp_base_url: str = Field(default="http://localhost:8000", alias="ANALYST_MCP_BASE_URL")
    analyst_mcp_api_key: str = Field(default="change-me", alias="ANALYST_MCP_API_KEY")
    request_timeout_seconds: float = Field(default=120.0)
    embedding_dimensions: int = Field(default=1024)
    retrieval_limit: int = Field(default=6)
    retrieval_min_score: float = Field(default=0.2)
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")
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

    @cached_property
    def fallback_chat_models(self) -> list[str]:
        return [
            item.strip()
            for item in self.fallback_chat_models_raw.split(",")
            if item.strip()
        ]

    @cached_property
    def is_bedrock_chat_model(self) -> bool:
        return "bedrock" in self.default_chat_model.lower()

    @cached_property
    def effective_chat_rate_limit_rps(self) -> float:
        if self.chat_rate_limit_rps > 0:
            return float(self.chat_rate_limit_rps)
        if self.is_bedrock_chat_model:
            return 0.75
        return 0.0

    @cached_property
    def effective_chat_rate_limit_max_bucket_size(self) -> int:
        if self.chat_rate_limit_max_bucket_size > 0:
            return int(self.chat_rate_limit_max_bucket_size)
        if self.is_bedrock_chat_model:
            return 2
        return 0

    @cached_property
    def effective_chat_max_concurrent_requests(self) -> int:
        if self.chat_max_concurrent_requests > 0:
            return int(self.chat_max_concurrent_requests)
        if self.is_bedrock_chat_model:
            return 2
        return 0

    @cached_property
    def cors_allowed_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.cors_allowed_origins_raw.split(",")
            if item.strip()
        ]

    @cached_property
    def database_url_psycopg(self) -> str:
        return normalize_psycopg_dsn(self.database_url)


def normalize_psycopg_dsn(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if params.get("sslmode") == "no-verify":
        params["sslmode"] = "require"
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(params),
            parsed.fragment,
        )
    )


settings = RuntimeSettings()
