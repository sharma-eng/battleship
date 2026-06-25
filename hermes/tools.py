"""Core file/shell plugin for Hermes.

A plugin exposes three names that the registry in ``plugins.py`` collects:
``TOOLS`` (JSON-schema list sent to the API), ``HANDLERS`` (name -> callable),
and optionally ``CONFIRM_TOOLS`` (names that should be confirmed first).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

TOOLS = [
    {
        "name": "list_files",
        "description": (
            "List files and directories at a path, relative to the current "
            "working directory. Call this to explore the project layout. "
            "Defaults to the current directory."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory to list. Defaults to '.'.",
                },
            },
        },
    },
    {
        "name": "read_file",
        "description": "Read and return the text contents of a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path of the file to read."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Write text to a file, creating it or overwriting it if it exists. "
            "Parent directories are created as needed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path of the file to write."},
                "content": {"type": "string", "description": "Text to write."},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_command",
        "description": (
            "Run a shell command in the current working directory and return its "
            "combined stdout and stderr. Use for quick tasks like running tests "
            "or checking git status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to run."},
            },
            "required": ["command"],
        },
    },
]


# Tools that change the filesystem or run arbitrary code. A frontend can gate
# these behind a confirmation prompt (see Hermes(confirm=...)).
CONFIRM_TOOLS = {"write_file", "run_command"}


def _list_files(path: str = ".") -> str:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    if not p.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")
    entries = sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name))
    if not entries:
        return "(empty directory)"
    return "\n".join(f"{'dir ' if e.is_dir() else 'file'}  {e.name}" for e in entries)


def _read_file(path: str) -> str:
    return Path(path).read_text()


def _write_file(path: str, content: str) -> str:
    p = Path(path)
    if p.parent and not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return f"Wrote {len(content)} characters to {path}"


def _run_command(command: str) -> str:
    result = subprocess.run(
        command, shell=True, capture_output=True, text=True, timeout=60,
    )
    out = (result.stdout or "") + (result.stderr or "")
    return out.strip() or f"(no output, exit code {result.returncode})"


HANDLERS = {
    "list_files": _list_files,
    "read_file": _read_file,
    "write_file": _write_file,
    "run_command": _run_command,
}
