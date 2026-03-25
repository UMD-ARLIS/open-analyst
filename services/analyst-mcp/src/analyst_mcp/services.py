from __future__ import annotations

import logging
import mimetypes
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode, urlparse

import aioboto3
import httpx
from botocore.exceptions import ClientError

from .config import Settings
from .models import (
    ArtifactRecord,
    CapabilityResponse,
    HealthComponent,
    HealthDetailsResponse,
    PaperDetailResponse,
    PaperRecord,
    SearchResponse,
    StorageHealthResponse,
)
from .paper_store import LocalPaperStore, PostgresPaperStore
from .providers import ArxivProvider, OpenAlexProvider, ProviderRegistry, SemanticScholarProvider
from .request_context import get_request_context

logger = logging.getLogger(__name__)

ARTIFACT_SUFFIXES = {
    ".pdf",
    ".txt",
    ".text",
    ".md",
    ".tex",
    ".xml",
    ".json",
    ".csv",
    ".tsv",
    ".zip",
    ".gz",
    ".tgz",
    ".tar",
    ".docx",
    ".doc",
}

TEXT_ARTIFACT_SUFFIXES = {
    ".txt",
    ".text",
    ".md",
    ".tex",
    ".xml",
    ".json",
    ".csv",
    ".tsv",
}

DISCOVERABLE_ARTIFACT_SUFFIXES = (
    ".pdf",
    ".txt",
    ".md",
    ".tex",
    ".xml",
    ".json",
    ".csv",
    ".tsv",
    ".zip",
    ".gz",
    ".tgz",
    ".tar",
    ".docx",
    ".doc",
    ".bin",
)


@dataclass(slots=True)
class StorageScope:
    backend: str
    local_root: Path | None = None
    bucket: str | None = None
    region: str | None = None
    endpoint: str | None = None
    key_prefix: str = ""
    workspace_slug: str = ""
    project_id: str = ""
    api_base_url: str = ""


class DownloadObjectStoreAdapter:
    def __init__(self, service: "DownloadService") -> None:
        self.service = service

    def _current_store(self) -> LocalObjectStore | S3ObjectStore:
        return self.service._object_store(self.service._storage_scopes()[0])

    async def put_bytes(self, relative_path: str, content: bytes):
        return await self._current_store().put_bytes(relative_path, content)

    async def read_bytes(self, relative_path: str) -> bytes:
        return await self._current_store().read_bytes(relative_path)

    async def read_text(self, relative_path: str) -> str:
        store = self._current_store()
        if hasattr(store, "read_text"):
            return await store.read_text(relative_path)
        return (await store.read_bytes(relative_path)).decode("utf-8", errors="ignore")

    async def exists(self, relative_path: str) -> bool:
        return await self._current_store().exists(relative_path)

    def uri_for(self, relative_path: str) -> str:
        return self._current_store().uri_for(relative_path)


class LocalObjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    async def put_bytes(self, relative_path: str, content: bytes) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    async def read_bytes(self, relative_path: str) -> bytes:
        return (self.root / relative_path).read_bytes()

    async def read_text(self, relative_path: str) -> str:
        return (self.root / relative_path).read_text()

    async def exists(self, relative_path: str) -> bool:
        return (self.root / relative_path).exists()

    def uri_for(self, relative_path: str) -> str:
        return str(self.root / relative_path)


class S3ObjectStore:
    def __init__(
        self,
        settings: Settings,
        *,
        bucket: str | None = None,
        region: str | None = None,
        endpoint: str | None = None,
    ) -> None:
        self.settings = settings
        self.bucket = bucket or settings.s3_bucket
        self.region = region or settings.aws_region
        self.endpoint = endpoint or settings.minio_endpoint

    def _session(self) -> aioboto3.Session:
        kwargs: dict[str, str] = {"region_name": self.region}
        if self.settings.aws_access_key_id:
            kwargs["aws_access_key_id"] = self.settings.aws_access_key_id
        if self.settings.aws_secret_access_key:
            kwargs["aws_secret_access_key"] = self.settings.aws_secret_access_key.get_secret_value()
        return aioboto3.Session(**kwargs)

    async def put_bytes(self, relative_path: str, content: bytes) -> str:
        session = self._session()
        async with session.client("s3", endpoint_url=self.endpoint or None) as client:
            await client.put_object(Bucket=self.bucket, Key=relative_path, Body=content)
        return f"s3://{self.bucket}/{relative_path}"

    async def read_bytes(self, relative_path: str) -> bytes:
        session = self._session()
        async with session.client("s3", endpoint_url=self.endpoint or None) as client:
            response = await client.get_object(Bucket=self.bucket, Key=relative_path)
            return await response["Body"].read()

    async def exists(self, relative_path: str) -> bool:
        session = self._session()
        async with session.client("s3", endpoint_url=self.endpoint or None) as client:
            try:
                await client.head_object(Bucket=self.bucket, Key=relative_path)
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code")
                if code in {"404", "NoSuchKey", "NotFound"}:
                    return False
                raise
        return True

    def uri_for(self, relative_path: str) -> str:
        return f"s3://{self.bucket}/{relative_path}"


class DownloadService:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client
        self.object_store = DownloadObjectStoreAdapter(self)

    async def storage_health(self) -> StorageHealthResponse:
        scope = self._storage_scopes()[0]
        object_store = self._object_store(scope)
        if scope.backend == "local":
            return StorageHealthResponse(
                ok=True,
                backend="local",
                detail=f"Local storage root is {scope.local_root}.",
                sample_uri=str(scope.local_root),
            )
        probe_name = f"healthchecks/{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.txt"
        payload = f"analyst-mcp storage probe {datetime.now(UTC).isoformat()}".encode("utf-8")
        relative_path = self._scoped_relative_path(scope, probe_name)
        stored = await object_store.put_bytes(relative_path, payload)
        exists = await object_store.exists(relative_path)
        detail = f"S3 bucket {scope.bucket} write/read probe {'passed' if exists else 'failed'}."
        return StorageHealthResponse(
            ok=exists,
            backend="s3",
            detail=detail,
            bucket=scope.bucket,
            sample_uri=str(stored),
        )

    def _artifact_suffix(self, target_url: str, content_type: str) -> str:
        if content_type.startswith("application/pdf"):
            return ".pdf"
        suffix = Path(urlparse(target_url).path).suffix.lower()
        if suffix in ARTIFACT_SUFFIXES:
            return suffix
        if content_type.startswith("text/plain"):
            return ".txt"
        if content_type.startswith("application/json"):
            return ".json"
        if content_type.startswith("application/xml") or content_type.startswith("text/xml"):
            return ".xml"
        return ".bin"

    def _looks_like_artifact_url(self, url: str) -> bool:
        parsed = urlparse(url)
        suffix = Path(parsed.path).suffix.lower()
        if suffix in ARTIFACT_SUFFIXES:
            return True
        return any(token in parsed.path.lower() for token in ("/pdf", "/e-print", "/download", "/source"))

    def _is_artifact_response(self, target_url: str, content_type: str) -> bool:
        lowered = content_type.lower()
        if lowered.startswith("text/html"):
            return False
        if lowered.startswith(("application/pdf", "text/plain", "application/json", "application/xml", "text/xml")):
            return True
        if lowered.startswith("application/octet-stream"):
            return self._looks_like_artifact_url(target_url)
        suffix = Path(urlparse(target_url).path).suffix.lower()
        return suffix in ARTIFACT_SUFFIXES

    async def available_artifacts(self, paper: PaperRecord) -> list[dict[str, str]]:
        artifacts: list[dict[str, str]] = []
        seen_paths: set[str] = set()
        for suffix in DISCOVERABLE_ARTIFACT_SUFFIXES:
            for scope in self._storage_scopes():
                relative_path = self._scoped_relative_path(scope, self._artifact_leaf_path(paper, suffix))
                object_store = self._object_store(scope)
                if not await object_store.exists(relative_path):
                    continue
                uri = object_store.uri_for(relative_path)
                if uri in seen_paths:
                    continue
                seen_paths.add(uri)
                artifact_url, download_url = self._artifact_access_urls(paper, suffix)
                artifacts.append(
                    {
                        "kind": self._artifact_kind(suffix),
                        "suffix": suffix,
                        "relative_path": relative_path,
                        "path": uri,
                        "mime_type": self._artifact_mime_type(suffix),
                        "label": self._artifact_label(suffix),
                        "artifact_url": artifact_url or "",
                        "download_url": download_url or "",
                    }
                )
                break
        return artifacts

    async def read_artifact(self, paper: PaperRecord, kind: str = "any", suffix: str | None = None) -> tuple[dict[str, str], bytes]:
        artifacts = await self.available_artifacts(paper)
        if suffix:
            selected = next((artifact for artifact in artifacts if artifact["suffix"] == suffix), None)
        elif kind == "any":
            selected = artifacts[0] if artifacts else None
        else:
            selected = next((artifact for artifact in artifacts if artifact["kind"] == kind), None)
        if selected is None:
            raise FileNotFoundError(f"No stored artifact for {paper.canonical_id}")
        scope = next(
            (candidate for candidate in self._storage_scopes() if self._scoped_relative_path(candidate, self._artifact_leaf_path(paper, selected["suffix"])) == selected["relative_path"]),
            self._storage_scopes()[0],
        )
        return selected, await self._object_store(scope).read_bytes(selected["relative_path"])

    def _artifact_leaf_path(self, paper: PaperRecord, suffix: str) -> str:
        return f"{paper.provider}/{paper.source_id}/{paper.source_id}{suffix}"

    def _storage_scopes(self) -> list[StorageScope]:
        context = get_request_context()
        backend_hint = context.artifact_backend.strip().lower()
        workspace_slug = context.workspace_slug.strip()
        if backend_hint == "s3" or (backend_hint == "" and self.settings.storage_backend.lower() == "s3"):
            primary = StorageScope(
                backend="s3",
                bucket=(context.s3_bucket or self.settings.s3_bucket or "").strip(),
                region=(context.s3_region or self.settings.aws_region).strip(),
                endpoint=(context.s3_endpoint or self.settings.minio_endpoint or "").strip() or None,
                key_prefix=self._join_key_prefix(context.s3_prefix, "artifacts"),
                workspace_slug=workspace_slug,
                project_id=context.project_id.strip(),
                api_base_url=context.api_base_url.strip(),
            )
        else:
            base_root = Path((context.local_artifact_root or str(self.settings.storage_root)).strip() or str(self.settings.storage_root))
            scoped_root = base_root / workspace_slug / "artifacts" if workspace_slug else base_root
            primary = StorageScope(
                backend="local",
                local_root=scoped_root,
                workspace_slug=workspace_slug,
                project_id=context.project_id.strip(),
                api_base_url=context.api_base_url.strip(),
            )

        return [primary]

    def _object_store(self, scope: StorageScope) -> LocalObjectStore | S3ObjectStore:
        if scope.backend == "local":
            return LocalObjectStore(scope.local_root or self.settings.storage_root)
        return S3ObjectStore(
            self.settings,
            bucket=scope.bucket,
            region=scope.region,
            endpoint=scope.endpoint,
        )

    def _scoped_relative_path(self, scope: StorageScope, relative_path: str) -> str:
        if scope.backend != "s3":
            return relative_path
        prefix = self._join_key_prefix(scope.key_prefix, relative_path)
        return prefix or relative_path

    def _join_key_prefix(self, *parts: str | None) -> str:
        return "/".join(part.strip().strip("/") for part in parts if part and part.strip())

    def _artifact_access_urls(self, paper: PaperRecord, suffix: str) -> tuple[str | None, str | None]:
        context = get_request_context()
        project_id = context.project_id.strip()
        api_base_url = context.api_base_url.strip().rstrip("/")
        if not project_id or not api_base_url:
            return None, None
        identifier = quote(paper.canonical_id, safe="")
        query = urlencode({"suffix": suffix})
        base = f"{api_base_url}/api/projects/{quote(project_id, safe='')}/analyst-mcp/papers/{identifier}/artifact?{query}"
        return base, f"{base}&download=1"

    def _artifact_kind(self, suffix: str) -> str:
        if suffix == ".pdf":
            return "pdf"
        if suffix in TEXT_ARTIFACT_SUFFIXES:
            return "text"
        return "binary"

    def _artifact_label(self, suffix: str) -> str:
        if suffix == ".pdf":
            return "PDF"
        if suffix == ".txt":
            return "Extracted text"
        if suffix in TEXT_ARTIFACT_SUFFIXES:
            return suffix[1:].upper()
        return suffix[1:].upper() or "BIN"

    def _artifact_mime_type(self, suffix: str) -> str:
        mime_type, _ = mimetypes.guess_type(f"artifact{suffix}")
        if mime_type:
            return mime_type
        if suffix in TEXT_ARTIFACT_SUFFIXES:
            return "text/plain; charset=utf-8"
        return "application/octet-stream"

    async def download_paper(
        self,
        paper: PaperRecord,
        preferred_formats: list[str] | None = None,
        *,
        tavily_api_key: str = "",
    ) -> list[dict[str, Any]]:
        """Download a paper's content and store it as artifacts.

        Strategy per provider:
        1. If pdf_url is available, fetch the PDF directly from the source API.
        2. If no PDF, try Tavily Extract on the paper landing page for content.
        3. Fall back to the abstract as a .txt artifact.

        Returns a list of download result dicts compatible with the webapp's
        importLiteratureItem expectations.
        """
        # Check if we already have artifacts stored
        existing = await self.available_artifacts(paper)
        if existing:
            pdf = next((a for a in existing if a["kind"] == "pdf"), None)
            text = next((a for a in existing if a["kind"] == "text"), None)
            best = pdf or text or existing[0]
            return [
                {
                    "path": best["path"],
                    "mime_type": best["mime_type"],
                    "bytes_written": 0,
                    "extracted_text_path": text["path"] if text else None,
                    "provider": paper.provider,
                    "canonical_id": paper.canonical_id,
                }
            ]

        downloads: list[dict[str, Any]] = []
        scope = self._storage_scopes()[0]
        store = self._object_store(scope)

        # Strategy 1: Direct PDF fetch from source API
        pdf_stored = False
        if paper.pdf_url:
            try:
                resp = await self.client.get(
                    paper.pdf_url,
                    headers={"User-Agent": "open-analyst/1.0 (research tool)"},
                    timeout=60.0,
                    follow_redirects=True,
                )
                content_type = resp.headers.get("content-type", "")
                if resp.status_code == 200 and self._is_artifact_response(paper.pdf_url, content_type):
                    suffix = self._artifact_suffix(paper.pdf_url, content_type)
                    relative = self._scoped_relative_path(scope, self._artifact_leaf_path(paper, suffix))
                    uri = await store.put_bytes(relative, resp.content)
                    if not isinstance(uri, str):
                        uri = store.uri_for(relative)
                    downloads.append(
                        {
                            "path": uri,
                            "mime_type": content_type.split(";")[0].strip() or "application/pdf",
                            "bytes_written": len(resp.content),
                            "extracted_text_path": None,
                            "provider": paper.provider,
                            "canonical_id": paper.canonical_id,
                        }
                    )
                    pdf_stored = True
                    logger.info("Downloaded PDF for %s from %s (%d bytes)", paper.canonical_id, paper.pdf_url, len(resp.content))
                else:
                    logger.warning(
                        "PDF fetch for %s returned status=%d content-type=%s",
                        paper.canonical_id, resp.status_code, content_type,
                    )
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                logger.warning("PDF fetch failed for %s: %s", paper.canonical_id, exc)

        # Strategy 2: Tavily Extract on the paper landing page
        tavily_text: str | None = None
        if not pdf_stored and paper.url and tavily_api_key:
            try:
                resp = await self.client.post(
                    "https://api.tavily.com/extract",
                    json={"urls": [paper.url], "format": "markdown"},
                    headers={"Authorization": f"Bearer {tavily_api_key}"},
                    timeout=30.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results and results[0].get("raw_content"):
                        tavily_text = results[0]["raw_content"]
                        logger.info("Tavily extracted %d chars for %s", len(tavily_text), paper.canonical_id)
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                logger.warning("Tavily extract failed for %s: %s", paper.canonical_id, exc)

        # Store extracted text (from Tavily or abstract fallback)
        text_content = tavily_text or (paper.abstract or "").strip()
        if text_content:
            text_relative = self._scoped_relative_path(scope, self._artifact_leaf_path(paper, ".txt"))
            text_bytes = text_content.encode("utf-8")
            text_uri = await store.put_bytes(text_relative, text_bytes)
            if not isinstance(text_uri, str):
                text_uri = store.uri_for(text_relative)

            if pdf_stored and downloads:
                downloads[0]["extracted_text_path"] = text_uri
            else:
                downloads.append(
                    {
                        "path": text_uri,
                        "mime_type": "text/plain; charset=utf-8",
                        "bytes_written": len(text_bytes),
                        "extracted_text_path": text_uri,
                        "provider": paper.provider,
                        "canonical_id": paper.canonical_id,
                    }
                )

        if not downloads:
            raise FileNotFoundError(
                f"No downloadable content for {paper.canonical_id}: "
                f"no pdf_url, no extractable landing page, and no abstract."
            )

        return downloads


class AnalystService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.ensure_directories()
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(settings.request_timeout_seconds), follow_redirects=True)
        self.repository = PostgresPaperStore(settings) if settings.postgres_dsn else LocalPaperStore(settings)
        providers = [ArxivProvider(settings, self.client), OpenAlexProvider(settings, self.client), SemanticScholarProvider(settings, self.client)]
        self.providers = ProviderRegistry(providers)
        self.downloads = DownloadService(settings, self.client)

    async def initialize(self) -> None:
        await self.repository.initialize()

    async def close(self) -> None:
        await self.client.aclose()

    async def health_details(self) -> HealthDetailsResponse:
        storage = await self.downloads.storage_health()
        components = [
            HealthComponent(
                name="storage",
                ok=storage.ok,
                detail=storage.detail,
            ),
            HealthComponent(
                name="providers",
                ok=True,
                detail=(
                    "External provider search, fetch, and download tools are available."
                ),
            ),
        ]
        current_date = datetime.now(self.settings.tzinfo).date().isoformat()
        return HealthDetailsResponse(
            ok=all(component.ok for component in components),
            service_name=self.settings.service_name,
            current_date=current_date,
            components=components,
            search_available=True,
        )

    async def search_literature(self, query: str, sources: list[str] | None, date_from: str | None, date_to: str | None, limit: int) -> SearchResponse:
        summary = await self.providers.search_all_detailed(
            query=query,
            limit=limit,
            sources=sources,
            date_from=date_from,
            date_to=date_to,
        )
        await self.repository.save_papers(summary.records)
        current_date = datetime.now(self.settings.tzinfo).date().isoformat()
        return SearchResponse(
            query=query,
            current_date=current_date,
            results=summary.records,
            sources_used=sources or self.providers.provider_names(),
            status=summary.status,
            warnings=summary.warnings,
            provider_status=summary.provider_status,
            error=summary.error,
        )

    async def get_paper(self, identifier: str, provider: str | None = None) -> PaperRecord | None:
        cached = await self.repository.get_paper(identifier, provider=provider)
        if cached:
            return cached
        paper = await self.providers.get_paper(identifier, provider_name=provider)
        if paper:
            await self.repository.save_paper(paper)
        return paper

    async def list_artifacts(self, identifier: str, provider: str | None = None) -> list[ArtifactRecord]:
        paper = await self.get_paper(identifier, provider=provider)
        if paper is None:
            return []
        artifacts = await self.downloads.available_artifacts(paper)
        return [
            ArtifactRecord(
                kind=artifact["kind"],
                label=artifact["label"],
                suffix=artifact["suffix"],
                path=artifact["path"],
                mime_type=artifact["mime_type"],
                artifact_url=artifact.get("artifact_url") or None,
                download_url=artifact.get("download_url") or None,
            )
            for artifact in artifacts
        ]

    async def paper_detail(
        self,
        identifier: str,
        provider: str | None = None,
        include_graph: bool = False,
        graph_limit: int = 40,
    ) -> PaperDetailResponse | None:
        paper = await self.get_paper(identifier, provider=provider)
        if paper is None:
            return None
        detail = PaperDetailResponse(
            paper=paper,
            artifacts=await self.list_artifacts(paper.canonical_id),
            external_links={
                "paper_url": paper.url,
                "pdf_url": paper.pdf_url,
                "source_urls": paper.source_urls,
            },
        )
        detail.has_local_artifacts = bool(detail.artifacts)
        if detail.artifacts:
            detail.artifact_status = "stored"
        elif paper.pdf_url or paper.source_urls:
            detail.artifact_status = "external_only"
        else:
            detail.artifact_status = "none"
        return detail

    async def describe_capabilities(self) -> CapabilityResponse:
        return CapabilityResponse(
            service_name=self.settings.service_name,
            current_date=datetime.now(self.settings.tzinfo).date().isoformat(),
            providers=self.providers.provider_names(),
            mcp_tools=[
                "search_literature",
                "get_paper",
                "describe_capabilities",
                "storage_health",
            ],
            workflows=[
                "Search external providers for papers and metadata",
                "Download paper artifacts to local or S3 storage",
                "Open stored artifacts or fall back to external paper/source links",
            ],
            artifact_storage_backend=self.settings.storage_backend.lower(),
            artifact_storage_detail=(await self.downloads.storage_health()).detail,
        )

    async def download_paper(
        self,
        identifier: str,
        provider: str | None = None,
        preferred_formats: list[str] | None = None,
    ) -> dict[str, Any]:
        """Download paper content, store artifacts, return download results."""
        paper = await self.get_paper(identifier, provider=provider)
        if paper is None:
            raise FileNotFoundError(f"Paper not found: {identifier}")

        tavily_key = self.settings.tavily_api_key.get_secret_value() if self.settings.tavily_api_key else ""
        results = await self.downloads.download_paper(
            paper,
            preferred_formats=preferred_formats,
            tavily_api_key=tavily_key,
        )
        return {"downloads": results, "paper": paper.model_dump(mode="json")}

    async def storage_health(self) -> StorageHealthResponse:
        return await self.downloads.storage_health()
