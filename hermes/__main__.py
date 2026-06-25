"""Interactive REPL for Hermes. Run with:  python -m hermes"""

import sys

try:  # optional: load ANTHROPIC_API_KEY from a local .env if python-dotenv is present
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from .agent import Hermes


def main() -> None:
    print("Hermes agent. Type a message, or 'exit' / Ctrl-D to quit.\n")
    agent = Hermes()
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
        try:
            reply = agent.send(user_input)
        except Exception as exc:  # keep the REPL alive on API/tool errors
            print(f"[error] {exc}", file=sys.stderr)
            continue
        print(f"\nhermes> {reply}\n")


if __name__ == "__main__":
    main()
