# Hermes

A basic **tool-using AI agent** that runs on your computer, built on the Claude API
(`claude-opus-4-8`). Hermes chats with you in the terminal and can use tools to
explore and modify files in the working directory.

This is the starter version — small and easy to read so you can extend it.

## What it can do

Hermes runs a standard agentic tool loop: it calls the model, the model decides
whether to use a tool, Hermes runs the tool and feeds the result back, and the
loop repeats until the model has a final answer. The built-in tools are:

| Tool | What it does | Confirmation |
|------|--------------|--------------|
| `list_files` | List a directory | — |
| `read_file` | Read a file's contents | — |
| `write_file` | Create or overwrite a file | asks first |
| `run_command` | Run a shell command and capture its output | asks first |

Responses **stream live** as they're generated, tool calls are shown inline, and
the two tools that change your system (`write_file`, `run_command`) prompt for
**confirmation** before running.

## Setup

Requires Python 3.10+.

```bash
# 1. (optional but recommended) create a virtual environment
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate

# 2. install dependencies
pip install -r requirements.txt

# 3. provide your API key
cp .env.example .env
# then edit .env and paste your key, or instead export it:
export ANTHROPIC_API_KEY=sk-ant-...
```

Get an API key from the [Anthropic Console](https://console.anthropic.com/).

## Run it

```bash
python -m hermes
```

You'll get a prompt. Try things like:

```
you> what files are in this directory?
you> read agent.py and explain what it does
you> create a file notes.txt with three ideas for extending you
you> run the tests and tell me if they pass
```

Type `exit` (or Ctrl-D) to quit.

## Use it from Python

```python
from hermes import Hermes

agent = Hermes()
print(agent.send("List the Python files here and summarize each in one line."))
```

The conversation is kept on the `Hermes` instance, so follow-up `send()` calls
share context.

`Hermes` accepts optional hooks so a frontend can stream output and gate tools:

```python
agent = Hermes(
    on_text=lambda delta: print(delta, end=""),   # stream assistant text
    on_tool=lambda name, inp: print("tool:", name),  # surface tool activity
    confirm=lambda name, inp: True,                # approve destructive tools
)
```

When no `confirm` hook is passed, tools run without prompting — convenient for
scripts, but pass one (or run the REPL) when a human should approve changes.

## Project layout

```
hermes/
  agent.py     # the Hermes class + the tool-use loop
  tools.py     # tool schemas and their Python handlers
  __main__.py  # the interactive REPL (python -m hermes)
requirements.txt
.env.example
```

## ⚠️ A note on safety

The `run_command` tool executes shell commands and `write_file` overwrites files
— both act on whatever directory you launch Hermes from. The REPL asks for
confirmation before each of these runs, but a confirmed shell command can still
do anything you can, so run Hermes in a directory you're comfortable with
(ideally a sandbox or a throwaway project). Note that programmatic use without a
`confirm` hook skips the prompt entirely.

## Ideas for extending Hermes

- Add more tools (web search, git operations, an HTTP fetch).
- Restrict file/command tools to an allowlisted working directory.
- Persist conversations to disk so sessions resume.
- Swap the manual loop for the SDK's `tool_runner` helper.
