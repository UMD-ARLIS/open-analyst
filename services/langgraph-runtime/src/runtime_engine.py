from __future__ import annotations

import ast
import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from uuid import uuid4

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, message_to_dict
from langgraph.types import Command

from graph import build_runtime_graph
from pg_checkpointer import create_checkpointer
from pg_store import create_store
from runtime_context import runtime_context_service
from runtime_db import runtime_db
from telemetry import get_tracer

logger = logging.getLogger(__name__)
tracer = get_tracer("open-analyst.runtime")
INTERRUPT_REPR_RE = re.compile(r"^Interrupt\(value=(.*), id='([^']*)'\)$", re.DOTALL)


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _message_to_payload(message: BaseMessage) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": str(getattr(message, "id", "") or ""),
        "type": getattr(message, "type", "message"),
        "content": getattr(message, "content", ""),
    }
    tool_calls = getattr(message, "tool_calls", None)
    if isinstance(tool_calls, list):
        payload["tool_calls"] = tool_calls
    additional_kwargs = getattr(message, "additional_kwargs", None)
    if isinstance(additional_kwargs, dict) and additional_kwargs:
        payload["additional_kwargs"] = additional_kwargs
    return payload


def _message_to_stream_payload(message: BaseMessage) -> dict[str, Any]:
    serialized = message_to_dict(message)
    data = serialized.get("data") if isinstance(serialized, dict) else {}
    payload = _serialize_json(data) if isinstance(data, dict) else {}
    payload["type"] = serialized.get("type") if isinstance(serialized, dict) else type(message).__name__
    return payload


def _serialize_json(value: Any) -> Any:
    if isinstance(value, BaseMessage):
        return _message_to_payload(value)
    if value.__class__.__name__ == "Overwrite" and hasattr(value, "value"):
        return _serialize_json(getattr(value, "value"))
    if isinstance(value, dict):
        return {str(key): _serialize_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_json(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "model_dump"):
        try:
            return _serialize_json(value.model_dump())
        except Exception:
            return str(value)
    if hasattr(value, "dict"):
        try:
            return _serialize_json(value.dict())
        except Exception:
            return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _normalize_input_messages(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    input_payload = payload.get("input")
    if isinstance(input_payload, dict) and isinstance(input_payload.get("messages"), list):
        return [
            {
                "role": "user" if str(item.get("role")) in {"human", "user"} else str(item.get("role") or "user"),
                "content": item.get("content"),
            }
            for item in input_payload["messages"]
            if isinstance(item, dict)
        ]
    if isinstance(payload.get("messages"), list):
        return [
            {
                "role": "user" if str(item.get("role")) in {"human", "user"} else str(item.get("role") or "user"),
                "content": item.get("content"),
            }
            for item in payload["messages"]
            if isinstance(item, dict)
        ]
    return []


def _input_messages_to_langchain(messages: list[dict[str, Any]]) -> list[BaseMessage]:
    serialized_messages: list[BaseMessage] = []
    for item in messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "user").strip().lower()
        content = item.get("content")
        if role in {"assistant", "ai"}:
            serialized_messages.append(AIMessage(content=content))
            continue
        if role == "system":
            serialized_messages.append(SystemMessage(content=content))
            continue
        serialized_messages.append(HumanMessage(content=content))
    return serialized_messages


def _latest_prompt(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if str(message.get("role") or "").lower() not in {"user", "human"}:
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _event_name(event_type: str, namespace: tuple[str, ...] | list[str] | None) -> str:
    cleaned = [str(item).strip() for item in (namespace or ()) if str(item).strip()]
    if not cleaned:
        return event_type
    return f"{event_type}|{'|'.join(cleaned)}"


def _parse_interrupt_candidate(value: Any) -> tuple[str | None, dict[str, Any] | None]:
    if isinstance(value, dict):
        interrupt_id = str(value.get("id") or "") or None
        nested_value = value.get("value")
        if nested_value is not None and not isinstance(nested_value, dict):
            nested_id, nested_payload = _parse_interrupt_candidate(nested_value)
            if nested_payload is not None:
                return interrupt_id or nested_id, nested_payload
        if isinstance(nested_value, dict):
            return interrupt_id, nested_value
        return interrupt_id, value

    if hasattr(value, "value"):
        interrupt_id = getattr(value, "id", None)
        nested_id, payload = _parse_interrupt_candidate(getattr(value, "value"))
        return str(interrupt_id or nested_id or "") or None, payload

    if not isinstance(value, str):
        return None, None

    text = value.strip()
    if not text:
        return None, None

    match = INTERRUPT_REPR_RE.match(text)
    if match:
        payload_src, interrupt_id = match.groups()
        try:
            parsed_payload = ast.literal_eval(payload_src)
        except Exception:
            return interrupt_id or None, None
        return interrupt_id or None, parsed_payload if isinstance(parsed_payload, dict) else None

    try:
        parsed = ast.literal_eval(text)
    except Exception:
        return None, None
    return None, parsed if isinstance(parsed, dict) else None


def _normalize_interrupt_record(item: Any, index: int) -> dict[str, Any] | None:
    interrupt_id: str | None = None
    payload: dict[str, Any] | None = None

    if isinstance(item, dict):
        interrupt_id = str(item.get("id") or "") or None
        candidate_value = item.get("value")
        nested_id, nested_payload = _parse_interrupt_candidate(candidate_value)
        if nested_payload is not None:
            interrupt_id = interrupt_id or nested_id
            payload = nested_payload
        else:
            _, payload = _parse_interrupt_candidate(item)

    if payload is None:
        interrupt_id, payload = _parse_interrupt_candidate(item)

    if payload is None:
        serialized = _serialize_json(item)
        if isinstance(serialized, dict):
            if "value" in serialized and isinstance(serialized.get("value"), dict):
                payload = serialized["value"]
            else:
                payload = serialized
            interrupt_id = interrupt_id or str(serialized.get("id") or "") or None

    if payload is None:
        return None

    return {
        "id": interrupt_id or f"interrupt-{index}",
        "value": _serialize_json(payload) if isinstance(payload, dict) else {"value": payload},
    }


def _normalize_interrupts(raw_interrupts: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if not isinstance(raw_interrupts, (list, tuple)):
        return normalized
    for index, item in enumerate(raw_interrupts):
        normalized_interrupt = _normalize_interrupt_record(item, index)
        if normalized_interrupt is not None:
            normalized.append(normalized_interrupt)
    return normalized


def _normalize_values_payload(data: Any, raw_interrupts: Any) -> dict[str, Any]:
    payload = _serialize_json(data)
    if not isinstance(payload, dict):
        payload = {}
    interrupts = _normalize_interrupts(raw_interrupts)
    if interrupts:
        payload["__interrupt__"] = interrupts
    return payload


def _normalize_stream_part(part: dict[str, Any]) -> tuple[str, Any, dict[str, Any] | None, list[dict[str, Any]]]:
    part_type = str(part.get("type") or "").strip()
    namespace = tuple(str(item) for item in (part.get("ns") or ()) if str(item).strip())

    if part_type == "values":
        payload = _normalize_values_payload(part.get("data"), part.get("interrupts"))
        interrupts = _normalize_interrupts(part.get("interrupts"))
        return _event_name("values", namespace), payload, payload, interrupts

    if part_type == "messages":
        raw_data = part.get("data")
        if isinstance(raw_data, (list, tuple)) and len(raw_data) == 2:
            message, metadata = raw_data
            payload = [_message_to_stream_payload(message), _serialize_json(metadata)]
        else:
            payload = _serialize_json(raw_data)
        return _event_name("messages", namespace), payload, None, []

    payload = _serialize_json(part.get("data"))
    interrupts = _normalize_interrupts(payload.get("__interrupt__")) if isinstance(payload, dict) else []
    return _event_name(part_type or "custom", namespace), payload, None, interrupts


class RuntimeEngine:
    def __init__(self) -> None:
        self._graph: Any | None = None
        self._store: Any | None = None
        self._checkpointer: Any | None = None
        self._run_tasks: dict[str, asyncio.Task[Any]] = {}
        self._subscribers: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)

    async def initialize(self) -> None:
        await runtime_db.initialize()
        self._checkpointer = await create_checkpointer()
        self._store = await create_store()
        self._graph = build_runtime_graph(checkpointer=self._checkpointer, store=self._store)

    async def create_thread(self, metadata: dict[str, Any]) -> dict[str, Any]:
        project_id = str(metadata.get("project_id") or "").strip()
        if not project_id:
            raise ValueError("project_id is required")
        thread_id = str(uuid4())
        title = str(metadata.get("title") or "Untitled thread").strip() or "Untitled thread"
        summary = str(metadata.get("summary") or "").strip() or None
        analysis_mode = str(metadata.get("analysis_mode") or "chat").strip() or "chat"
        collection_id = str(metadata.get("collection_id") or "").strip() or None
        return await runtime_db.create_thread(
            thread_id=thread_id,
            project_id=project_id,
            title=title,
            summary=summary,
            analysis_mode=analysis_mode,
            collection_id=collection_id,
            metadata=metadata,
        )

    async def get_thread(self, thread_id: str) -> dict[str, Any] | None:
        return await runtime_db.get_thread(thread_id)

    async def update_thread(self, thread_id: str, metadata: dict[str, Any]) -> dict[str, Any] | None:
        title = str(metadata.get("title") or "").strip() or None
        summary = str(metadata.get("summary") or "").strip() or None
        analysis_mode = str(metadata.get("analysis_mode") or "").strip() or None
        collection_id = str(metadata.get("collection_id") or "").strip() or None
        return await runtime_db.update_thread(
            thread_id,
            title=title,
            summary=summary,
            analysis_mode=analysis_mode,
            collection_id=collection_id,
            metadata=metadata,
        )

    async def delete_thread(self, thread_id: str) -> None:
        await runtime_db.soft_delete_thread(thread_id)

    async def search_threads(self, metadata: dict[str, Any], limit: int = 20) -> list[dict[str, Any]]:
        project_id = str(metadata.get("project_id") or "").strip()
        if not project_id:
            return []
        return await runtime_db.search_threads(project_id, limit=limit)

    async def get_thread_state(self, thread_id: str) -> dict[str, Any]:
        thread = await runtime_db.get_thread(thread_id)
        if not thread:
            raise ValueError("Thread not found")
        values = dict(thread.get("last_values")) if isinstance(thread.get("last_values"), dict) else {}
        interrupts = self._extract_interrupts(values)
        if interrupts:
            values["__interrupt__"] = interrupts
        run = await runtime_db.get_run(str(thread.get("current_run_id") or "").strip()) if thread.get("current_run_id") else None
        return {"thread": thread, "values": values, "run": run}

    async def search_store_items(
        self,
        namespace_prefix: list[str],
        *,
        query: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        if self._store is None:
            return []
        items = await self._store.asearch(tuple(namespace_prefix), query=query, limit=limit)
        return [
            {
                "namespace": list(item.namespace),
                "key": item.key,
                "value": _serialize_json(item.value),
                "updated_at": getattr(item, "updated_at", None),
            }
            for item in items
        ]

    async def put_store_item(
        self,
        namespace: list[str],
        key: str,
        value: dict[str, Any],
    ) -> dict[str, Any]:
        if self._store is None:
            raise RuntimeError("Store is not initialized")
        await self._store.aput(tuple(namespace), key, value)
        return {
            "namespace": list(namespace),
            "key": key,
            "value": _serialize_json(value),
        }

    async def delete_store_item(self, namespace: list[str], key: str) -> None:
        if self._store is None:
            raise RuntimeError("Store is not initialized")
        await self._store.adelete(tuple(namespace), key)

    async def start_run(
        self,
        thread_id: str,
        body: dict[str, Any],
        *,
        request_base_url: str,
    ) -> dict[str, Any]:
        thread = await runtime_db.get_thread(thread_id)
        if not thread:
            raise ValueError("Thread not found")
        active = await runtime_db.get_active_run_for_thread(thread_id)
        if active:
            return active

        run_id = str(uuid4())
        input_messages = _normalize_input_messages(body)
        command = body.get("command") if isinstance(body.get("command"), dict) else None
        metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        merged_metadata = {
            **(thread.get("metadata") if isinstance(thread.get("metadata"), dict) else {}),
            **metadata,
        }
        await runtime_db.update_thread(thread_id, metadata=merged_metadata)
        await runtime_db.create_run(
            run_id=run_id,
            thread_id=thread_id,
            status="queued",
            input_payload=body.get("input") if isinstance(body.get("input"), dict) else {"messages": input_messages},
            command_payload=command,
        )
        await runtime_db.set_thread_run_state(thread_id, run_id=run_id, status="queued")
        task = asyncio.create_task(
            self._run_graph(
                thread_id=thread_id,
                run_id=run_id,
                metadata=merged_metadata,
                input_messages=input_messages,
                command=command,
                request_base_url=request_base_url,
            )
        )
        self._run_tasks[run_id] = task
        return {"id": run_id, "thread_id": thread_id, "status": "queued"}

    async def _normalize_resume_payload(self, thread_id: str, resume: Any) -> Any:
        if not isinstance(resume, dict):
            return resume
        pending_interrupts = await runtime_db.list_pending_interrupts(thread_id)
        if len(pending_interrupts) != 1 or len(resume) != 1:
            return resume
        interrupt_id = str(pending_interrupts[0].get("id") or "").strip()
        if not interrupt_id or interrupt_id not in resume:
            return resume
        return resume.get(interrupt_id)

    async def cancel_run(self, thread_id: str, run_id: str) -> None:
        task = self._run_tasks.get(run_id)
        if task and not task.done():
            task.cancel()
            return
        await runtime_db.update_run_status(run_id, status="cancelled", completed=True)
        await runtime_db.set_thread_run_state(thread_id, run_id=None, status="cancelled")
        await self._record_event(
            run_id,
            "done",
            {"status": "cancelled", "thread_id": thread_id, "run_id": run_id},
        )

    async def subscribe(self, run_id: str) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._subscribers[run_id].append(queue)
        try:
            while True:
                item = await queue.get()
                yield item
                if str(item.get("event") or "") in {"done", "error"}:
                    break
        finally:
            subscribers = self._subscribers.get(run_id) or []
            if queue in subscribers:
                subscribers.remove(queue)

    async def _run_graph(
        self,
        *,
        thread_id: str,
        run_id: str,
        metadata: dict[str, Any],
        input_messages: list[dict[str, Any]],
        command: dict[str, Any] | None,
        request_base_url: str,
    ) -> None:
        if self._graph is None:
            raise RuntimeError("Runtime graph is not initialized")
        project_id = str(metadata.get("project_id") or "").strip()
        if not project_id:
            raise ValueError("project_id is required")
        collection_id = str(metadata.get("collection_id") or "").strip() or None
        analysis_mode = str(metadata.get("analysis_mode") or "chat").strip() or "chat"
        prompt = _latest_prompt(input_messages)
        context = await runtime_context_service.build_context(
            project_id,
            collection_id=collection_id,
            analysis_mode=analysis_mode,
            api_base_url=request_base_url,
            prompt=prompt,
            messages=input_messages,
        )
        runnable_config = {
            "configurable": {"thread_id": thread_id},
            "run_id": run_id,
            "thread_id": thread_id,
        }
        payload: Any
        if command and "resume" in command:
            resume_payload = await self._normalize_resume_payload(thread_id, command.get("resume"))
            payload = Command(resume=resume_payload)
            await runtime_db.resolve_interrupts(thread_id, run_id, {"resume": resume_payload})
        else:
            payload = {"messages": _input_messages_to_langchain(input_messages)}

        await runtime_db.update_run_status(run_id, status="running")
        await runtime_db.set_thread_run_state(thread_id, run_id=run_id, status="running")
        await self._record_event(run_id, "metadata", {"run_id": run_id, "thread_id": thread_id})

        sequence_no = 1
        last_values: dict[str, Any] = {}
        try:
            with tracer.start_as_current_span("runtime.run_graph"):
                async for part in self._graph.astream(
                    payload,
                    config=runnable_config,
                    context=context,
                    stream_mode=["values", "messages", "updates", "tasks", "custom"],
                    subgraphs=True,
                    version="v2",
                ):
                    event_name, event_payload, next_values, interrupts = _normalize_stream_part(part)
                    if next_values is not None:
                        last_values = next_values
                        thread_status = "interrupted" if interrupts else "running"
                        await runtime_db.set_thread_run_state(
                            thread_id,
                            run_id=run_id if thread_status == "running" else None,
                            status=thread_status,
                            last_values=next_values,
                        )
                        await runtime_db.upsert_interrupts(
                            thread_id=thread_id,
                            run_id=run_id,
                            interrupts=interrupts,
                        )
                        await runtime_db.update_run_status(
                            run_id,
                            status=thread_status,
                            last_event_seq=sequence_no,
                        )
                    await runtime_db.append_run_event(
                        run_id=run_id,
                        sequence_no=sequence_no,
                        event_type=event_name,
                        payload=event_payload,
                    )
                    await self._broadcast(
                        run_id,
                        {
                            "run_id": run_id,
                            "sequence_no": sequence_no,
                            "event": event_name,
                            "data": event_payload,
                            "created_at": _utcnow(),
                        },
                    )
                    sequence_no += 1
            final_interrupts = self._extract_interrupts(last_values)
            if final_interrupts:
                status = "interrupted"
                await runtime_db.set_thread_run_state(
                    thread_id,
                    run_id=None,
                    status=status,
                    last_values=last_values,
                )
            else:
                status = "completed"
                await runtime_db.set_thread_run_state(
                    thread_id,
                    run_id=None,
                    status=status,
                    last_values=last_values,
                )
            await runtime_db.update_run_status(
                run_id,
                status=status,
                last_event_seq=sequence_no,
                completed=status != "interrupted",
            )
            await self._record_event(
                run_id,
                "done",
                {
                    "run_id": run_id,
                    "thread_id": thread_id,
                    "status": status,
                },
            )
        except asyncio.CancelledError:
            logger.info("Run %s cancelled", run_id)
            await runtime_db.update_run_status(run_id, status="cancelled", last_event_seq=sequence_no, completed=True)
            await runtime_db.set_thread_run_state(thread_id, run_id=None, status="cancelled")
            await self._record_event(
                run_id,
                "done",
                {"run_id": run_id, "thread_id": thread_id, "status": "cancelled"},
            )
            raise
        except Exception as exc:
            logger.exception("Run %s failed", run_id)
            await runtime_db.update_run_status(
                run_id,
                status="failed",
                error=str(exc),
                last_event_seq=sequence_no,
                completed=True,
            )
            await runtime_db.set_thread_run_state(thread_id, run_id=None, status="failed")
            await self._record_event(
                run_id,
                "error",
                {
                    "error": str(exc),
                    "message": str(exc),
                    "run_id": run_id,
                    "thread_id": thread_id,
                },
            )
            await self._record_event(
                run_id,
                "done",
                {
                    "status": "failed",
                    "error": str(exc),
                    "run_id": run_id,
                    "thread_id": thread_id,
                },
            )
        finally:
            self._run_tasks.pop(run_id, None)

    async def _record_event(self, run_id: str, event_type: str, payload: dict[str, Any]) -> None:
        run = await runtime_db.get_run(run_id)
        next_seq = int(run.get("last_event_seq") or 0) + 1 if run else 1
        await runtime_db.append_run_event(run_id=run_id, sequence_no=next_seq, event_type=event_type, payload=payload)
        if event_type == "done":
            status = str(payload.get("status") or "completed")
            await runtime_db.update_run_status(
                run_id,
                status=status,
                error=str(payload.get("error") or "") or None,
                last_event_seq=next_seq,
                completed=status in {"completed", "failed", "cancelled"},
            )
        elif event_type == "error":
            await runtime_db.update_run_status(
                run_id,
                status="failed",
                error=str(payload.get("error") or "Runtime run failed."),
                last_event_seq=next_seq,
                completed=True,
            )
        else:
            await runtime_db.update_run_status(run_id, status=str(run.get("status") or "running"), last_event_seq=next_seq)
        await self._broadcast(
            run_id,
            {
                "run_id": run_id,
                "sequence_no": next_seq,
                "event": event_type,
                "data": payload,
                "created_at": _utcnow(),
            },
        )

    async def _broadcast(self, run_id: str, event: dict[str, Any]) -> None:
        for subscriber in list(self._subscribers.get(run_id) or []):
            await subscriber.put(event)

    def _extract_interrupts(self, values: dict[str, Any]) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for key in ("__interrupt__", "interrupt", "interrupts"):
            raw = values.get(key)
            if isinstance(raw, list):
                for index, item in enumerate(raw):
                    normalized = _normalize_interrupt_record(item, index)
                    if normalized is not None:
                        candidates.append(normalized)
            elif raw is not None:
                normalized = _normalize_interrupt_record(raw, 0)
                if normalized is not None:
                    candidates.append(normalized)
        return candidates


runtime_engine = RuntimeEngine()
