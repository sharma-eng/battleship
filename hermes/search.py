"""Web search plugin for Hermes — uses Claude's server-side web search tool.

This is a *server tool*: the model issues the query and the Claude API runs the
search on Anthropic's infrastructure and feeds results back inline. There is no
client-side handler to run and no third-party API key to manage.

Requires web search to be enabled for your API account. If your account can't
use it (requests error out), disable this plugin with HERMES_WEB_SEARCH=0.
"""

from __future__ import annotations

# Server-executed — nothing to dispatch client-side.
HANDLERS: dict = {}

# `web_search_20260209` is available on claude-opus-4-8. `max_uses` bounds cost
# per turn. See the Claude API "Server Tools" reference for allowed_domains,
# blocked_domains, and user_location options.
TOOLS = [
    {
        "type": "web_search_20260209",
        "name": "web_search",
        "max_uses": 5,
    },
]
