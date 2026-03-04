"""Open Analyst Strands Agent — BedrockAgentCore entrypoint."""

import logging

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from agent_factory import create_agent, _build_prompt

logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()


def _extract_text(result) -> str:
    """Extract text from a Strands agent result."""
    if isinstance(result, str):
        return result
    if hasattr(result, "message"):
        msg = result.message
        if hasattr(msg, "content"):
            parts = []
            for block in msg.content:
                if hasattr(block, "text"):
                    parts.append(block.text)
                elif isinstance(block, dict) and "text" in block:
                    parts.append(block["text"])
            return "\n".join(parts)
    return str(result)


def _invoke_sync(payload: dict) -> dict:
    """Non-streaming invocation — returns full result as JSON."""
    try:
        agent = create_agent(payload)
        prompt = _build_prompt(payload.get("messages", []))
        result = agent(prompt)
        return {
            "text": _extract_text(result),
            "traces": [],
        }
    except Exception as e:
        logger.exception("Agent invocation failed")
        return {
            "text": f"Error: {e}",
            "traces": [],
        }


async def _invoke_stream(payload: dict):
    """Streaming invocation — yields SSE events as they arrive."""
    agent = create_agent(payload)
    prompt = _build_prompt(payload.get("messages", []))
    last_tool_use_id = None

    async for event in agent.stream_async(prompt):
        data = event.get("data")
        if data:
            yield {"type": "text_delta", "text": data}

        reasoning = event.get("reasoningText")
        if reasoning:
            yield {"type": "reasoning_delta", "text": reasoning}

        tool_use = event.get("current_tool_use")
        if tool_use and isinstance(tool_use, dict):
            tool_id = tool_use.get("toolUseId") or tool_use.get("id")
            tool_name = tool_use.get("name", "")
            if tool_id and tool_id != last_tool_use_id:
                last_tool_use_id = tool_id
                yield {
                    "type": "tool_call_start",
                    "toolName": tool_name,
                    "toolUseId": tool_id,
                }

        if event.get("complete"):
            yield {"type": "agent_end"}


@app.entrypoint
def invoke(payload: dict):
    """Route to streaming or non-streaming handler.

    BedrockAgentCoreApp detects generators and returns SSE automatically.
    """
    if payload.get("stream", False):
        return _invoke_stream(payload)
    return _invoke_sync(payload)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run()
