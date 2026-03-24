from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Author(BaseModel):
    name: str
    author_id: str | None = None
    affiliation: str | None = None


class DownloadCandidate(BaseModel):
    url: str
    label: str
    mime_type: str | None = None


class PaperRecord(BaseModel):
    canonical_id: str
    provider: str
    source_id: str
    title: str
    abstract: str | None = None
    published_at: datetime | None = None
    updated_at: datetime | None = None
    doi: str | None = None
    authors: list[Author] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    citation_count: int | None = None
    reference_count: int | None = None
    venue: str | None = None
    url: str | None = None
    pdf_url: str | None = None
    source_urls: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    current_date: str
    results: list[PaperRecord]
    sources_used: list[str]
    status: Literal["ok", "partial", "error"] = "ok"
    warnings: list[str] = Field(default_factory=list)
    provider_status: dict[str, str] = Field(default_factory=dict)
    error: str | None = None


class DownloadResult(BaseModel):
    canonical_id: str
    provider: str
    path: str
    mime_type: str | None = None
    bytes_written: int


class CapabilityResponse(BaseModel):
    service_name: str
    current_date: str
    providers: list[str] = Field(default_factory=list)
    mcp_tools: list[str] = Field(default_factory=list)
    workflows: list[str] = Field(default_factory=list)
    artifact_storage_backend: str
    artifact_storage_detail: str


class StorageHealthResponse(BaseModel):
    ok: bool
    backend: str
    detail: str
    bucket: str | None = None
    sample_uri: str | None = None


class HealthComponent(BaseModel):
    name: str
    ok: bool
    detail: str


class HealthDetailsResponse(BaseModel):
    ok: bool
    service_name: str
    current_date: str
    components: list[HealthComponent] = Field(default_factory=list)
    search_available: bool = True


class ArtifactRecord(BaseModel):
    kind: str
    label: str
    suffix: str
    path: str
    mime_type: str
    artifact_url: str | None = None
    download_url: str | None = None


class PaperDetailResponse(BaseModel):
    paper: PaperRecord
    artifacts: list[ArtifactRecord] = Field(default_factory=list)
    external_links: dict[str, Any] = Field(default_factory=dict)
    has_local_artifacts: bool = False
    artifact_status: Literal["stored", "external_only", "none"] = "none"
