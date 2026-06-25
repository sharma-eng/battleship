"""Browser plugin for Hermes — navigate the web with Playwright + Chromium.

Optional: the registry in ``plugins.py`` enables this only when the
``playwright`` package is installed. A single headless Chromium page is started
lazily on first use and reused across tool calls.

Environment overrides (all optional):
  HERMES_BROWSER_EXECUTABLE  path to a Chromium binary (default: Playwright's own)
  HERMES_BROWSER_PROXY       proxy server, e.g. http://127.0.0.1:8080
  HERMES_BROWSER_HEADLESS    "0" to show the browser window (default: headless)
"""

from __future__ import annotations

import os

_TEXT_LIMIT = 4000
_session = None  # tuple: (playwright, browser, page)


def _launch_kwargs() -> dict:
    kwargs: dict = {"headless": os.environ.get("HERMES_BROWSER_HEADLESS", "1") != "0"}
    exe = os.environ.get("HERMES_BROWSER_EXECUTABLE")
    if exe:
        kwargs["executable_path"] = exe
    proxy = os.environ.get("HERMES_BROWSER_PROXY")
    if proxy:
        kwargs["proxy"] = {"server": proxy}
    return kwargs


def _page():
    """Return the shared page, starting Chromium on first call."""
    global _session
    if _session is None:
        from playwright.sync_api import sync_playwright

        pw = sync_playwright().start()
        browser = pw.chromium.launch(**_launch_kwargs())
        page = browser.new_page()
        _session = (pw, browser, page)
    return _session[2]


def _visible_text(page) -> str:
    try:
        text = page.inner_text("body").strip()
    except Exception:
        text = ""
    if len(text) > _TEXT_LIMIT:
        text = text[:_TEXT_LIMIT] + f"\n...[truncated; {len(text)} chars total]"
    return text or "(page has no visible text)"


def _navigate(url: str) -> str:
    if not url.startswith(("http://", "https://", "file://", "data:")):
        url = "https://" + url
    page = _page()
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    return f"Loaded {page.url}\nTitle: {page.title()}\n\n{_visible_text(page)}"


def _read() -> str:
    page = _page()
    return f"{page.url}\nTitle: {page.title()}\n\n{_visible_text(page)}"


def _click(selector: str) -> str:
    page = _page()
    page.click(selector, timeout=10000)
    page.wait_for_load_state("domcontentloaded")
    return f"Clicked {selector!r}. Now at {page.url}\n\n{_visible_text(page)}"


def _type(selector: str, text: str, submit: bool = False) -> str:
    page = _page()
    page.fill(selector, text, timeout=10000)
    if submit:
        page.press(selector, "Enter")
        page.wait_for_load_state("domcontentloaded")
        return (f"Typed into {selector!r} and submitted. Now at {page.url}\n\n"
                f"{_visible_text(page)}")
    return f"Typed {text!r} into {selector!r}."


def _screenshot(path: str = "screenshot.png") -> str:
    page = _page()
    page.screenshot(path=path, full_page=True)
    return f"Saved a full-page screenshot to {path}"


def close() -> None:
    """Shut down the browser if it was started."""
    global _session
    if _session is not None:
        pw, browser, _ = _session
        try:
            browser.close()
        finally:
            pw.stop()
            _session = None


HANDLERS = {
    "browser_navigate": _navigate,
    "browser_read": _read,
    "browser_click": _click,
    "browser_type": _type,
    "browser_screenshot": _screenshot,
}

# Clicking and typing can take actions on a site (submit forms, etc.), so gate
# them behind confirmation. Navigating and reading are treated as safe.
CONFIRM_TOOLS = {"browser_click", "browser_type"}

_SELECTOR_HELP = (
    "An element selector: a CSS selector (e.g. \"input[name='q']\", \"#submit\") "
    "or a Playwright text selector (e.g. \"text=Sign in\")."
)

TOOLS = [
    {
        "name": "browser_navigate",
        "description": (
            "Open a URL in the browser and return the page title and visible text. "
            "Start here to visit a web page."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to open (https:// assumed if omitted)."},
            },
            "required": ["url"],
        },
    },
    {
        "name": "browser_read",
        "description": "Return the current page's URL, title, and visible text.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "browser_click",
        "description": "Click an element on the current page, then return the resulting page text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": _SELECTOR_HELP},
            },
            "required": ["selector"],
        },
    },
    {
        "name": "browser_type",
        "description": (
            "Type text into an input field. Set submit=true to press Enter "
            "afterwards (e.g. to run a search)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": _SELECTOR_HELP},
                "text": {"type": "string", "description": "Text to type into the field."},
                "submit": {
                    "type": "boolean",
                    "description": "Press Enter after typing. Defaults to false.",
                },
            },
            "required": ["selector", "text"],
        },
    },
    {
        "name": "browser_screenshot",
        "description": "Save a full-page screenshot of the current page to a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Output file path. Defaults to screenshot.png."},
            },
        },
    },
]
