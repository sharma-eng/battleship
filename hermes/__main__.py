"""Interactive REPL for Hermes. Run with:  python -m hermes"""

import sys

try:  # optional: load ANTHROPIC_API_KEY from a local .env if python-dotenv is present
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from .agent import Hermes
from .plugins import shutdown


def _short(value: dict) -> str:
    """One-line preview of a tool's input for display."""
    text = ", ".join(f"{k}={v!r}" for k, v in value.items())
    return text if len(text) <= 80 else text[:77] + "..."


def on_text(delta: str) -> None:
    print(delta, end="", flush=True)


def on_tool(name: str, tool_input: dict) -> None:
    print(f"\n  ⚙ {name}({_short(tool_input)})", flush=True)


def confirm(name: str, tool_input: dict) -> bool:
    print(f"\n  ⚠ Hermes wants to run {name}({_short(tool_input)})")
    try:
        answer = input("    allow? [y/N] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return answer in {"y", "yes"}


def main() -> None:
    print("Hermes agent. Type a message, or 'exit' / Ctrl-D to quit.\n")
    agent = Hermes(on_text=on_text, on_tool=on_tool, confirm=confirm)
    try:
        while True:
            try:
                user_input = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nbye")
                break
            if not user_input:
                continue
            if user_input.lower() in {"exit", "quit"}:
                print("bye")
                break
            print("\nhermes> ", end="", flush=True)
            try:
                agent.send(user_input)  # text streams live via on_text
            except Exception as exc:  # keep the REPL alive on API/tool errors
                print(f"\n[error] {exc}", file=sys.stderr)
                continue
            print("\n")
    finally:
        shutdown()  # close the browser if the plugin started one


if __name__ == "__main__":
    main()
