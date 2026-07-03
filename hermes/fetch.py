"""HTTP fetch plugin for Hermes — a lightweight GET without a full browser.

Good for APIs (JSON), raw docs, and pages that don't need JavaScript rendering.
Uses only the standard library, so it adds no dependency. For interactive or
JS-heavy sites, use the browser plugin instead.
"""

from __future__ import annotations

import html as _html
import re
import urllib.request

_LIMIT = 6000
_MAX_BYTES = 2_000_000
_UA = "Hermes/0.1 (+https://github.com/; agent http_fetch)"


def _strip_html(markup: str) -> str:
    markup = re.sub(r"(?is)<(script|style|noscript|template).*?</\1>", " ", markup)
    text = re.sub(r"(?s)<[^>]+>", " ", markup)
    text = _html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _fetch(url: str, raw: bool = False) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    request = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(request, timeout=30) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        ctype = resp.headers.get_content_type()
        body = resp.read(_MAX_BYTES)
        final_url = resp.geturl()

    text = body.decode(charset, errors="replace")
    if not raw and "html" in ctype:
        text = _strip_html(text)
    if len(text) > _LIMIT:
        text = text[:_LIMIT] + f"\n...[truncated; {len(text)} chars total]"
    return f"GET {final_url} [{ctype}]\n\n{text or '(empty response body)'}"


HANDLERS = {"http_fetch": _fetch}

TOOLS = [
    {
        "name": "http_fetch",
        "description": (
            "Fetch a URL over HTTP(S) and return its contents. HTML is reduced to "
            "readable text; set raw=true for the unmodified body (use for JSON or "
            "APIs). Faster than the browser when a page doesn't need rendering."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to fetch (https:// assumed if omitted)."},
                "raw": {
                    "type": "boolean",
                    "description": "Return the raw body instead of stripped text. Defaults to false.",
                },
            },
            "required": ["url"],
        },
    },
]
