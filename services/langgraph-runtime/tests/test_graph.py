import pytest

from graph import build_initial_state, invoke_run
from models import RuntimeProjectContext, RuntimeRunRequest


def build_request(prompt: str = "Summarize the project risks") -> RuntimeRunRequest:
    return RuntimeRunRequest(
        run_id="run-123",
        prompt=prompt,
        mode="chat",
        project=RuntimeProjectContext(
            project_id="project-1",
            project_name="Project One",
            brief="Track major operational risks and key assumptions.",
        ),
    )


def test_build_initial_state_uses_prompt():
    state = build_initial_state(build_request("Assess evidence quality"))
    assert state.prompt == "Assess evidence quality"
    assert state.project.project_id == "project-1"
    assert state.messages[0].content == "Assess evidence quality"


@pytest.mark.asyncio
async def test_invoke_run_returns_plan_and_text():
    result = await invoke_run(build_request())
    assert result.status == "completed"
    assert result.active_plan
    assert result.final_text
