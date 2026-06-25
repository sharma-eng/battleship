"""The Hermes agent: a manual tool-use loop over the Claude Messages API."""

from __future__ import annotations

from anthropic import Anthropic

from .tools import TOOLS, dispatch_tool

MODEL = "claude-opus-4-8"
MAX_TOKENS = 16000

SYSTEM_PROMPT = """You are Hermes, a helpful AI agent running on the user's computer.

You have tools to list directories, read files, write files, and run shell
commands in the current working directory. Use them when they help you carry out
the user's request, and briefly say what you're doing as you go.

For minor choices (file names, formatting, which of two equivalent approaches),
pick a reasonable option and note it rather than asking. For destructive actions
(deleting files, overwriting important data), confirm first.

Be concise. When a task is done, lead with the outcome in a sentence or two."""


def _text(content) -> str:
    """Concatenate the text blocks of an assistant message."""
    return "".join(b.text for b in content if b.type == "text").strip()


class Hermes:
    """A minimal conversational tool-using agent.

    Holds the running conversation in ``self.messages`` and drives the
    Claude API tool-use loop until the model produces a final answer.
    """

    def __init__(self, client: Anthropic | None = None, model: str = MODEL,
                 system: str = SYSTEM_PROMPT):
        # Anthropic() reads ANTHROPIC_API_KEY (or an `ant auth login` profile).
        self.client = client or Anthropic()
        self.model = model
        self.system = system
        self.messages: list[dict] = []

    def send(self, user_input: str) -> str:
        """Send a user turn and return Hermes's final text reply."""
        self.messages.append({"role": "user", "content": user_input})
        return self._run()

    def _run(self) -> str:
        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=self.system,
                thinking={"type": "adaptive"},
                tools=TOOLS,
                messages=self.messages,
            )

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
                output, is_error = dispatch_tool(tu.name, tu.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": output,
                    "is_error": is_error,
                })
            # All tool results for one assistant turn go in a single user message.
            self.messages.append({"role": "user", "content": results})
