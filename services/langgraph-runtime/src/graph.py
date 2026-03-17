from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncIterator

from langgraph.graph import END, StateGraph

from config import settings
from models import (
    Message,
    RuntimeEvent,
    RuntimeEvidenceItem,
    RuntimeInvocationResult,
    RuntimePlanItem,
    RuntimeRunRequest,
    RuntimeState,
)
from telemetry import get_tracer

try:
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover
    ChatOpenAI = None

tracer = get_tracer()


def _fallback_plan(prompt: str) -> list[RuntimePlanItem]:
    base = prompt.strip() or "analyst task"
    return [
        RuntimePlanItem(id=str(uuid.uuid4()), title=f"Clarify objective: {base[:80]}", actor="planner"),
        RuntimePlanItem(id=str(uuid.uuid4()), title="Gather project and external evidence", actor="researcher"),
        RuntimePlanItem(id=str(uuid.uuid4()), title="Draft analyst-facing output", actor="writer"),
        RuntimePlanItem(id=str(uuid.uuid4()), title="Review for citations, confidence, and gaps", actor="reviewer"),
    ]


def _fallback_evidence(state: RuntimeState) -> list[RuntimeEvidenceItem]:
    items: list[RuntimeEvidenceItem] = []
    if state.project.brief:
        items.append(
            RuntimeEvidenceItem(
                title="Project brief",
                evidence_type="project_brief",
                extracted_text=state.project.brief,
                citation_text="Project profile",
                confidence="high",
                provenance={"source": "project_profile"},
            )
        )
    items.append(
        RuntimeEvidenceItem(
            title="Prompt-derived objective",
            evidence_type="run_intent",
            extracted_text=state.prompt,
            citation_text="Current run intent",
            confidence="medium",
            provenance={"source": "run_prompt"},
        )
    )
    return items


async def _model_response(system_prompt: str, user_prompt: str) -> str:
    if ChatOpenAI is None:
        return ""
    if not settings.litellm_api_key and not settings.litellm_base_url:
        return ""
    try:
        model = ChatOpenAI(**settings.chat_model_kwargs)
        response = await model.ainvoke(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
    except Exception:
        return ""
    return str(getattr(response, "content", "") or "").strip()


async def planner_node(state: RuntimeState) -> RuntimeState:
    with tracer.start_as_current_span("planner_node"):
        plan = _fallback_plan(state.prompt)
        try:
            raw = await _model_response(
                "You are an analyst workflow planner. Return a JSON array of 3-5 concise plan items.",
                state.prompt,
            )
            if raw:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    plan = [
                        RuntimePlanItem(
                            id=str(uuid.uuid4()),
                            title=str(item.get("title") if isinstance(item, dict) else item).strip() or "Plan item",
                            actor=str(item.get("actor") if isinstance(item, dict) else "planner") or "planner",
                        )
                        for item in parsed[:5]
                    ]
        except Exception:
            pass
        return state.model_copy(update={"status": "running", "active_plan": plan})


async def researcher_node(state: RuntimeState) -> RuntimeState:
    with tracer.start_as_current_span("researcher_node"):
        evidence = _fallback_evidence(state)
        return state.model_copy(update={"evidence_bundle": evidence})


async def writer_node(state: RuntimeState) -> RuntimeState:
    with tracer.start_as_current_span("writer_node"):
        evidence_text = "\n".join(
            f"- {item.title}: {item.extracted_text[:280]}" for item in state.evidence_bundle
        ).strip()
        draft = await _model_response(
            (
                "You are Open Analyst. Draft a concise, project-aware analyst response. "
                "Use the supplied evidence and include a short plan and identified gaps."
            ),
            (
                f"Project brief:\n{state.project.brief or '(none)'}\n\n"
                f"Prompt:\n{state.prompt}\n\n"
                f"Evidence:\n{evidence_text or '(none)'}"
            ),
        )
        if not draft:
            draft = (
                f"Objective: {state.prompt}\n\n"
                "Working plan:\n"
                + "\n".join(f"- {item.title}" for item in state.active_plan)
                + "\n\nKey evidence:\n"
                + (evidence_text or "- No evidence gathered yet.")
            )
        return state.model_copy(update={"draft": draft})


async def reviewer_node(state: RuntimeState) -> RuntimeState:
    with tracer.start_as_current_span("reviewer_node"):
        final_text = await _model_response(
            (
                "You are an analyst output reviewer. Tighten the draft, preserve substance, "
                "and end with a short section named 'Open Questions' if uncertainty remains."
            ),
            state.draft,
        )
        if not final_text:
            final_text = state.draft
        completed_plan = [
            item.model_copy(update={"status": "completed"}) for item in state.active_plan
        ]
        return state.model_copy(
            update={
                "status": "completed",
                "active_plan": completed_plan,
                "final_text": final_text,
            }
        )


def build_graph():
    graph = StateGraph(RuntimeState)
    graph.add_node("planner", planner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("writer", writer_node)
    graph.add_node("reviewer", reviewer_node)
    graph.set_entry_point("planner")
    graph.add_edge("planner", "researcher")
    graph.add_edge("researcher", "writer")
    graph.add_edge("writer", "reviewer")
    graph.add_edge("reviewer", END)
    return graph.compile()


GRAPH = build_graph()


def build_initial_state(request: RuntimeRunRequest) -> RuntimeState:
    return RuntimeState(
        run_id=request.run_id,
        prompt=request.prompt,
        mode=request.mode,
        project=request.project,
        messages=request.messages or [Message(role="user", content=request.prompt)],
    )


async def invoke_run(request: RuntimeRunRequest) -> RuntimeInvocationResult:
    state = build_initial_state(request)
    result = await GRAPH.ainvoke(state)
    return RuntimeInvocationResult(
        status=result["status"],
        final_text=result["final_text"],
        active_plan=result["active_plan"],
        evidence_bundle=result["evidence_bundle"],
        approvals=result["approvals"],
    )


async def stream_run(request: RuntimeRunRequest) -> AsyncIterator[RuntimeEvent]:
    state = build_initial_state(request)
    yield RuntimeEvent(type="status", phase="planner", status="running", actor="planner", text="Planning run")
    await asyncio.sleep(0)
    state = await planner_node(state)
    yield RuntimeEvent(
        type="plan",
        phase="planner",
        status="running",
        actor="planner",
        text="Plan ready",
        plan=[item.model_dump(mode="json") for item in state.active_plan],
    )

    yield RuntimeEvent(type="status", phase="research", status="running", actor="researcher", text="Gathering project evidence")
    await asyncio.sleep(0)
    state = await researcher_node(state)
    yield RuntimeEvent(
        type="evidence",
        phase="research",
        status="running",
        actor="researcher",
        text="Evidence bundle updated",
        evidence=[item.model_dump(mode="json") for item in state.evidence_bundle],
    )

    yield RuntimeEvent(type="status", phase="writer", status="running", actor="writer", text="Drafting analyst response")
    await asyncio.sleep(0)
    state = await writer_node(state)
    yield RuntimeEvent(type="draft", phase="writer", status="running", actor="writer", text=state.draft)

    yield RuntimeEvent(type="status", phase="review", status="running", actor="reviewer", text="Reviewing draft")
    await asyncio.sleep(0)
    state = await reviewer_node(state)
    for line in state.final_text.splitlines(keepends=True):
        if line:
            yield RuntimeEvent(type="text_delta", phase="review", status="running", actor="reviewer", text=line)
            await asyncio.sleep(0)

    yield RuntimeEvent(
        type="run_completed",
        phase="completed",
        status="completed",
        actor="supervisor",
        text="Run complete",
        plan=[item.model_dump(mode="json") for item in state.active_plan],
        evidence=[item.model_dump(mode="json") for item in state.evidence_bundle],
    )
