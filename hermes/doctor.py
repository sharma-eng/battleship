"""Preflight checks — is Hermes ready to run, including web browsing?

Run with:  python -m hermes.doctor
"""

from __future__ import annotations

import importlib.util
import os
import sys


def _ok(label: str, detail: str = "") -> None:
    print(f"  [ok]   {label}" + (f" — {detail}" if detail else ""))


def _warn(label: str, detail: str = "") -> None:
    print(f"  [warn] {label}" + (f" — {detail}" if detail else ""))


def _fail(label: str, detail: str = "") -> None:
    print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def check() -> int:
    """Print a readiness report. Returns the number of blocking problems."""
    problems = 0
    print("Hermes preflight check\n")

    # Core dependency
    if importlib.util.find_spec("anthropic"):
        _ok("anthropic SDK installed")
    else:
        _fail("anthropic SDK missing", "pip install -r requirements.txt")
        problems += 1

    # API key
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass
    if os.environ.get("ANTHROPIC_API_KEY"):
        _ok("ANTHROPIC_API_KEY set")
    else:
        _fail("ANTHROPIC_API_KEY not set", "export it, or put it in a .env file")
        problems += 1

    # Browser plugin (optional capability)
    if importlib.util.find_spec("playwright"):
        _ok("playwright installed")
        try:
            from playwright.sync_api import sync_playwright

            from .browser import _launch_kwargs

            with sync_playwright() as pw:
                browser = pw.chromium.launch(**_launch_kwargs())
                browser.close()
            _ok("Chromium launches — web browsing ready")
        except Exception as exc:
            _warn(
                "Chromium not launchable",
                f"{type(exc).__name__}; run 'playwright install chromium'",
            )
    else:
        _warn(
            "playwright not installed — web browsing disabled",
            "pip install playwright && playwright install chromium",
        )

    print()
    if problems:
        print(f"{problems} blocking issue(s) — fix the [FAIL] items above before running.")
    else:
        print("Hermes is ready. Start it with:  python -m hermes")
    return problems


if __name__ == "__main__":
    sys.exit(1 if check() else 0)
