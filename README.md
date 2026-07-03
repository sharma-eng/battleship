# Hermes

A basic **tool-using AI agent** that runs on your computer, built on the Claude API
(`claude-opus-4-8`). Hermes chats with you in the terminal and can use tools to
explore and modify files in the working directory.

This is the starter version — small and easy to read so you can extend it.

## What it can do

Hermes runs a standard agentic tool loop: it calls the model, the model decides
whether to use a tool, Hermes runs the tool and feeds the result back, and the
loop repeats until the model has a final answer.

Tools are organized as **plugins** (files/shell, web search, HTTP fetch, and a
full browser). The built-in tools:

| Tool | What it does | Confirmation |
|------|--------------|--------------|
| `list_files` | List a directory | — |
| `read_file` | Read a file's contents | — |
| `write_file` | Create or overwrite a file | asks first |
| `run_command` | Run a shell command and capture its output | asks first |
| `web_search` | Search the web (Claude's server-side search) | — |
| `http_fetch` | GET a URL (page/JSON) without a browser | — |
| `browser_navigate` | Open a URL and read the page | — |
| `browser_read` | Re-read the current page | — |
| `browser_click` | Click an element | asks first |
| `browser_type` | Type into a field (optionally submit) | asks first |
| `browser_screenshot` | Save a full-page screenshot | — |

Responses **stream live** as they're generated, tool calls are shown inline, and
tools that change your system or act on a web page prompt for **confirmation**
before running.

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

### Enable web browsing

The browser plugin uses [Playwright](https://playwright.dev/python/) with
Chromium. After `pip install -r requirements.txt`, download the browser once:

```bash
playwright install chromium
```

That's it — Hermes auto-detects Playwright and exposes the `browser_*` tools. If
Playwright isn't installed, Hermes still runs with just the file/shell tools.

Optional environment overrides:

| Variable | Effect |
|----------|--------|
| `HERMES_WEB_SEARCH=0` | Disable the `web_search` tool (for accounts without web search enabled) |
| `HERMES_BROWSER_HEADLESS=0` | Show the browser window instead of running headless |
| `HERMES_BROWSER_EXECUTABLE` | Use a specific Chromium binary instead of Playwright's |
| `HERMES_BROWSER_PROXY` | Route the browser through a proxy (e.g. `http://127.0.0.1:8080`) |

`web_search` uses Claude's **server-side** web search — no third-party API key is
needed, but your Anthropic account must have web search enabled. `http_fetch` and
the browser tools need no extra account features.

## Check your setup

Verify everything (SDK, API key, and that the browser launches) before running:

```bash
python -m hermes.doctor
```

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
you> go to news.ycombinator.com and tell me the top 3 story titles
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
  agent.py     # the Hermes class + the streaming tool-use loop
  plugins.py   # registry: combines plugins, dispatches tool calls
  tools.py     # core plugin: file + shell tools
  fetch.py     # http_fetch plugin (stdlib GET)
  search.py    # web_search plugin (Claude server-side search)
  browser.py   # browser plugin: Playwright/Chromium web tools
  doctor.py    # preflight readiness check (python -m hermes.doctor)
  __main__.py  # the interactive REPL (python -m hermes)
requirements.txt
.env.example
```

Adding a capability = writing a plugin module that exposes `TOOLS`,
`HANDLERS`, and optional `CONFIRM_TOOLS`, then registering it in `plugins.py`.

## ⚠️ A note on safety

The `run_command` tool executes shell commands and `write_file` overwrites files
— both act on whatever directory you launch Hermes from. The REPL asks for
confirmation before each of these runs, but a confirmed shell command can still
do anything you can, so run Hermes in a directory you're comfortable with
(ideally a sandbox or a throwaway project). Note that programmatic use without a
`confirm` hook skips the prompt entirely.

## Ideas for extending Hermes

- Add an `edit_file` (find-and-replace) tool for surgical code changes.
- Add a `memory` plugin so Hermes remembers across sessions.
- Feed `browser_screenshot` images back to the model for visual page understanding.
- Restrict file/command tools to an allowlisted working directory.
- Persist conversations to disk so sessions resume.
