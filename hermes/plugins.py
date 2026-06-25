"""Plugin registry: combine tool plugins into one schema list + dispatcher.

Each plugin module exposes ``TOOLS``, ``HANDLERS``, and optionally
``CONFIRM_TOOLS``. New capabilities are added by writing a plugin module and
registering it here.
"""

from __future__ import annotations

import importlib.util

from . import tools as _core

TOOLS: list[dict] = []
CONFIRM_TOOLS: set[str] = set()
_HANDLERS: dict = {}


def _register(module) -> None:
    TOOLS.extend(module.TOOLS)
    _HANDLERS.update(module.HANDLERS)
    CONFIRM_TOOLS.update(getattr(module, "CONFIRM_TOOLS", set()))


_register(_core)

# The browser plugin needs Playwright. Enable it only if the package is present
# so Hermes still runs (without web tools) when Playwright isn't installed.
BROWSER_AVAILABLE = importlib.util.find_spec("playwright") is not None
if BROWSER_AVAILABLE:
    from . import browser as _browser

    _register(_browser)


def dispatch_tool(name: str, tool_input: dict) -> tuple[str, bool]:
    """Execute a tool by name. Returns (output_text, is_error)."""
    handler = _HANDLERS.get(name)
    if handler is None:
        return f"Unknown tool: {name}", True
    try:
        return handler(**tool_input), False
    except Exception as exc:  # surface the failure to the model so it can adapt
        return f"Error running {name}: {exc}", True


def shutdown() -> None:
    """Release plugin resources (e.g. close the browser)."""
    if BROWSER_AVAILABLE:
        _browser.close()
