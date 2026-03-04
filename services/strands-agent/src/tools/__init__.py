"""Tool registry for the Open Analyst Strands agent."""

from .file_tools import (
    list_directory,
    read_file,
    write_file,
    edit_file,
    glob_search,
    grep_search,
)
from .command_tools import execute_command


def create_file_tools(workspace_dir: str) -> list:
    """Create file and command tools bound to a workspace directory."""
    return [
        list_directory,
        read_file,
        write_file,
        edit_file,
        glob_search,
        grep_search,
        execute_command,
    ]


def create_project_tools(
    workspace_dir: str,
    project_id: str = "",
    api_base_url: str = "http://localhost:5173",
    collection_id: str = "",
    collection_name: str = "Task Sources",
) -> list:
    """Assemble all tools for a project agent invocation."""
    tools = create_file_tools(workspace_dir)

    # Web, research, and project tools are added in Phase 1.3.3
    try:
        from .web_tools import web_fetch, web_search
        from .research_tools import arxiv_search, hf_daily_papers, hf_paper, deep_research
        from .project_tools import collection_overview

        tools.extend([
            web_fetch,
            web_search,
            arxiv_search,
            hf_daily_papers,
            hf_paper,
            deep_research,
            collection_overview,
        ])
    except ImportError:
        pass

    return tools
