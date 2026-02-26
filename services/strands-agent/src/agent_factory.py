"""Creates the Strands Agent with model, tools, and system prompt."""

import litellm
from strands import Agent
from strands.models import LiteLLMModel

from config import settings
from tools import create_project_tools

# Bedrock requires conversations to start with a user message.
# This tells LiteLLM to auto-rewrite system messages for compatibility.
litellm.modify_params = True

SYSTEM_PROMPT = """You are Open Analyst, an AI research assistant.

You help users research topics, analyze documents, and organize findings into structured projects.

## Capabilities
- File operations: read, write, edit, list, search files in the project workspace
- Web research: fetch web pages, search the web, search arXiv, browse HuggingFace papers
- Deep research: conduct multi-step research with automated source gathering and synthesis
- Project management: organize findings into collections, query project knowledge base

## Guidelines
- Always cite sources when presenting research findings using [R#] notation
- Organize captured content into appropriate collections
- Be concise but thorough in analysis
- When uncertain, acknowledge limitations and suggest next steps
"""


def _build_system_prompt(payload: dict) -> str:
    """Build the system prompt, optionally augmented with RAG context."""
    base = SYSTEM_PROMPT

    # RAG context injection: query the Node.js project store for relevant docs
    project_id = payload.get("project_id", "")
    api_base_url = payload.get("api_base_url", settings.node_api_base_url)
    if project_id:
        try:
            from util.capture import ProjectAPI

            api = ProjectAPI(api_base_url, project_id)
            last_user = _get_last_user_message(payload.get("messages", []))
            if last_user:
                rag = api.rag_query(last_user, limit=6)
                results = rag.get("results", [])
                if results:
                    ctx = "\n\n".join(
                        f'[R{i + 1}] {r.get("title", "")}\n'
                        f'Source: {r.get("sourceUri", "")}\n'
                        f'Snippet: {r.get("snippet", "")}'
                        for i, r in enumerate(results)
                    )
                    base += (
                        f"\n\nUse project retrieval context when helpful. "
                        f"Cite as [R#].\n\n{ctx}"
                    )
        except Exception:
            pass  # RAG failure is non-fatal

    return base


def _get_last_user_message(messages: list) -> str:
    """Extract the last user message from the conversation."""
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            return str(msg.get("content", ""))
    return ""


def _build_prompt(messages: list) -> str:
    """Build the prompt string from messages for the agent invocation."""
    parts = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "user")
        content = str(msg.get("content", ""))
        if role == "system":
            continue  # system prompt is handled separately
        parts.append(f"{role}: {content}")
    return "\n\n".join(parts) if parts else ""


def create_agent(payload: dict) -> Agent:
    """Create a configured Strands Agent from an invocation payload.

    Args:
        payload: The invocation payload containing messages, model config,
                 workspace info, and project context.

    Returns:
        A configured Strands Agent ready for invocation.
    """
    model = LiteLLMModel(
        client_args={
            "api_key": settings.litellm_api_key,
            "base_url": settings.litellm_base_url,
            "use_litellm_proxy": True,
        },
        model_id=payload.get("model_id", "anthropic/claude-sonnet-4"),
    )

    workspace_dir = payload.get("working_dir", ".")
    tools = create_project_tools(
        workspace_dir=workspace_dir,
        project_id=payload.get("project_id", ""),
        api_base_url=payload.get("api_base_url", settings.node_api_base_url),
        collection_id=payload.get("collection_id", ""),
        collection_name=payload.get("collection_name", "Task Sources"),
    )

    system_prompt = _build_system_prompt(payload)

    return Agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
    )
