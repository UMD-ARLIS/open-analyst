"""Command execution tool for the Strands agent."""

import subprocess

from strands import tool

from util.sandbox import resolve_in_workspace


@tool
def execute_command(
    command: str, cwd: str = ".", workspace_dir: str = "."
) -> str:
    """Execute a shell command within the workspace.

    Args:
        command: The shell command to run.
        cwd: Working directory relative to workspace (default: workspace root).
        workspace_dir: The workspace root directory.

    Returns:
        The combined stdout/stderr output (truncated to 100KB).
    """
    if not command or not command.strip():
        raise ValueError("command is required")

    resolved_cwd = resolve_in_workspace(workspace_dir, cwd)

    result = subprocess.run(
        command,
        shell=True,
        cwd=resolved_cwd,
        capture_output=True,
        text=True,
        timeout=60,
        env=None,  # inherit current env
    )

    output = result.stdout or result.stderr or "Command completed"
    return output[:100_000]
