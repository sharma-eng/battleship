"""The Hermes agent: a manual tool-use loop over the Claude Messages API."""

from __future__ import annotations

from typing import Callable

from anthropic import Anthropic

from .plugins import (
    BROWSER_AVAILABLE,
    CONFIRM_TOOLS,
    TOOLS,
    WEB_SEARCH_ENABLED,
    dispatch_tool,
)

MODEL = "claude-opus-4-8"
MAX_TOKENS = 16000

_BASE_PROMPT = """You are Hermes, a helpful AI agent running on the user's computer.

You have tools to list directories, read files, write files, and run shell
commands in the current working directory. Use them when they help you carry out
the user's request, and briefly say what you're doing as you go.

For minor choices (file names, formatting, which of two equivalent approaches),
pick a reasonable option and note it rather than asking. For destructive actions
(deleting files, overwriting important data), confirm first.

Be concise. When a task is done, lead with the outcome in a sentence or two."""

_FETCH_PROMPT = """

Use http_fetch to quickly GET a URL (pages, docs, JSON APIs) without a browser —
prefer it when a page doesn't need rendering."""

_SEARCH_PROMPT = """ Use web_search to find pages when you don't already have a URL."""

_BROWSER_PROMPT = """

For interactive or JavaScript-heavy sites, use the browser: browser_navigate to
open a page, browser_read to re-read it, and browser_click / browser_type to
interact. Selectors may be CSS (e.g. "input[name='q']") or Playwright text
selectors (e.g. "text=Sign in"). Read a page before acting on it."""

SYSTEM_PROMPT = (
    _BASE_PROMPT
    + _FETCH_PROMPT
    + (_SEARCH_PROMPT if WEB_SEARCH_ENABLED else "")
    + (_BROWSER_PROMPT if BROWSER_AVAILABLE else "")
)

# Callback signatures (all optional):
#   on_text(delta: str)            -> stream assistant text as it's generated
#   on_tool(name: str, input: dict)-> notified before a tool runs
#   confirm(name: str, input: dict) -> bool  gate a destructive tool call
TextHook = Callable[[str], None]
ToolHook = Callable[[str, dict], None]
ConfirmHook = Callable[[str, dict], bool]


def _text(content) -> str:
    """Concatenate the text blocks of an assistant message."""
    return "".join(b.text for b in content if b.type == "text").strip()


class Hermes:
    """A minimal conversational tool-using agent.

    Holds the running conversation in ``self.messages`` and drives the
    Claude API tool-use loop until the model produces a final answer.

    Optional hooks let a frontend stream text, surface tool activity, and
    approve destructive tool calls. By default tools run without prompting
    (suitable for programmatic use); the REPL wires up a real confirm prompt.
    """

    def __init__(self, client: Anthropic | None = None, model: str = MODEL,
                 system: str = SYSTEM_PROMPT, *, on_text: TextHook | None = None,
                 on_tool: ToolHook | None = None, confirm: ConfirmHook | None = None):
        # Anthropic() reads ANTHROPIC_API_KEY (or an `ant auth login` profile).
        self.client = client or Anthropic()
        self.model = model
        self.system = system
        self.on_text = on_text
        self.on_tool = on_tool
        self.confirm = confirm
        self.messages: list[dict] = []

    def send(self, user_input: str) -> str:
        """Send a user turn and return Hermes's final text reply."""
        self.messages.append({"role": "user", "content": user_input})
        return self._run()

    def _model_turn(self):
        """Make one streaming API call and return the final Message."""
        with self.client.messages.stream(
            model=self.model,
            max_tokens=MAX_TOKENS,
            system=self.system,
            thinking={"type": "adaptive"},
            tools=TOOLS,
            messages=self.messages,
        ) as stream:
            if self.on_text is not None:
                for event in stream:
                    if (event.type == "content_block_delta"
                            and event.delta.type == "text_delta"):
                        self.on_text(event.delta.text)
            return stream.get_final_message()

    def _run(self) -> str:
        while True:
            response = self._model_turn()

            # Preserve the full assistant turn (incl. thinking + tool_use blocks).
            self.messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "refusal":
                return "[Hermes declined to respond to that request.]"

            if response.stop_reason == "pause_turn":
                # A server-side tool loop paused; re-send to let it resume.
                continue

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if not tool_uses:
                # No tools requested — this is the final answer.
                return _text(response.content)

            results = []
            for tu in tool_uses:
                if self.on_tool is not None:
                    self.on_tool(tu.name, tu.input)
                output, is_error = self._execute(tu.name, tu.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": output,
                    "is_error": is_error,
                })
            # All tool results for one assistant turn go in a single user message.
            self.messages.append({"role": "user", "content": results})

    def _execute(self, name: str, tool_input: dict) -> tuple[str, bool]:
        """Run a tool, gating destructive ones behind ``confirm`` if provided."""
        if name in CONFIRM_TOOLS and self.confirm is not None:
            if not self.confirm(name, tool_input):
                return "User declined to run this action.", True
        return dispatch_tool(name, tool_input)
