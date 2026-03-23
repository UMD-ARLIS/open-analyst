from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

try:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
except Exception:  # pragma: no cover
    OTLPSpanExporter = None

from config import settings


def configure_telemetry() -> None:
    provider = TracerProvider(
        resource=Resource.create({"service.name": settings.otel_service_name})
    )

    if settings.otel_exporter_otlp_endpoint and OTLPSpanExporter is not None:
        exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)


def get_tracer(name: str = "open-analyst.langgraph") -> trace.Tracer:
    return trace.get_tracer(name)
