import pytest

from graph import (
    _phase_for_tool_name,
    build_initial_state,
    invoke_run,
)
from models import RuntimeProjectContext, RuntimeRunRequest


def build_request(
    prompt: str = "Summarize the project risks",
    *,
    available_skills: list[dict] | None = None,
    pinned_skill_ids: list[str] | None = None,
) -> RuntimeRunRequest:
    return RuntimeRunRequest(
        run_id="run-123",
        prompt=prompt,
        mode="chat",
        project=RuntimeProjectContext(
            project_id="project-1",
            project_name="Project One",
            brief="Track major operational risks and key assumptions.",
            available_skills=available_skills or [],
            pinned_skill_ids=pinned_skill_ids or [],
        ),
    )


def test_build_initial_state_uses_prompt():
    state = build_initial_state(build_request("Assess evidence quality"))
    assert state.prompt == "Assess evidence quality"
    assert state.project.project_id == "project-1"
    assert state.messages[0].content == "Assess evidence quality"
    assert state.phase == "analyze"


def test_phase_for_tool_name_classifies_correctly():
    assert _phase_for_tool_name("search_literature") == "acquire"
    assert _phase_for_tool_name("execute_command") == "artifact"
    assert _phase_for_tool_name("search_project_documents") == "analyze"
    assert _phase_for_tool_name("propose_project_memory") == "review"
    assert _phase_for_tool_name("unknown_tool") == "analyze"


@pytest.mark.asyncio
async def test_invoke_run_returns_text():
    result = await invoke_run(build_request())
    assert result.status == "completed"
    assert result.final_text
