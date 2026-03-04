"""Tests for command_tools.py — command execution within a sandboxed workspace."""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from tools.command_tools import execute_command


class TestExecuteCommand:
    def test_echo_command(self, workspace):
        result = execute_command(
            command="echo hello",
            workspace_dir=workspace,
        )
        assert "hello" in result

    def test_cwd_within_workspace(self, workspace):
        result = execute_command(
            command="pwd",
            cwd="subdir",
            workspace_dir=workspace,
        )
        assert "subdir" in result

    def test_empty_command_raises(self, workspace):
        with pytest.raises(ValueError, match="command is required"):
            execute_command(command="", workspace_dir=workspace)

    def test_timeout_exceeded(self, workspace):
        """Commands that exceed timeout should raise."""
        with pytest.raises(Exception):
            execute_command(
                command="sleep 120",
                workspace_dir=workspace,
            )

    def test_cwd_traversal_blocked(self, workspace):
        with pytest.raises(ValueError, match="outside working directory"):
            execute_command(
                command="ls",
                cwd="../../",
                workspace_dir=workspace,
            )
