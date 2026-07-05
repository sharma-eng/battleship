"""Offline tests for the Hermes agent loop, using a scripted mock model.

No API key required — the Anthropic client is replaced with a fake that returns
pre-scripted responses, so this exercises the tool loop, streaming hook,
confirmation gate, and refusal handling without any network calls.

Run with either:
    python tests/test_agent_offline.py
    pytest tests/test_agent_offline.py
"""

from __future__ import annotations

import os
import sys
import tempfile
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hermes.agent import Hermes


# ---- minimal mock of the Anthropic streaming client ----

def _txt(text):
    return types.SimpleNamespace(type="text", text=text)


def _tool(name, tool_id, tool_input):
    return types.SimpleNamespace(type="tool_use", name=name, id=tool_id, input=tool_input)


def _delta(text):
    return types.SimpleNamespace(
        type="content_block_delta",
        delta=types.SimpleNamespace(type="text_delta", text=text),
    )


def _msg(stop_reason, content):
    return types.SimpleNamespace(stop_reason=stop_reason, content=content)


class _FakeStream:
    def __init__(self, message):
        self._message = message

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        for block in self._message.content:
            if block.type == "text":
                yield _delta(block.text)

    def get_final_message(self):
        return self._message


def _fake_client(scripts):
    queue = list(scripts)

    def stream(**_kwargs):
        return _FakeStream(queue.pop(0))

    return types.SimpleNamespace(messages=types.SimpleNamespace(stream=stream))


# ---- tests ----

def test_tool_loop_then_final_answer():
    scripts = [
        _msg("tool_use", [_txt("Looking."), _tool("list_files", "t1", {"path": "."})]),
        _msg("end_turn", [_txt("Listed the directory.")]),
    ]
    agent = Hermes(client=_fake_client(scripts))
    reply = agent.send("what's here?")
    assert reply == "Listed the directory."
    tool_result = agent.messages[2]["content"][0]
    assert tool_result["type"] == "tool_result"
    assert tool_result["is_error"] is False


def test_confirm_denies_write():
    target = os.path.join(tempfile.mkdtemp(), "nope.txt")
    scripts = [
        _msg("tool_use", [_tool("write_file", "w1", {"path": target, "content": "x"})]),
        _msg("end_turn", [_txt("Skipped it.")]),
    ]
    agent = Hermes(client=_fake_client(scripts), confirm=lambda name, inp: False)
    agent.send("write it")
    result = agent.messages[2]["content"][0]
    assert result["is_error"] is True
    assert "declined" in result["content"].lower()
    assert not os.path.exists(target)


def test_confirm_allows_write():
    target = os.path.join(tempfile.mkdtemp(), "yes.txt")
    scripts = [
        _msg("tool_use", [_tool("write_file", "w2", {"path": target, "content": "hi"})]),
        _msg("end_turn", [_txt("Done.")]),
    ]
    agent = Hermes(client=_fake_client(scripts), confirm=lambda name, inp: True)
    agent.send("write it")
    assert os.path.exists(target)
    assert open(target).read() == "hi"


def test_streaming_hook_receives_text():
    chunks = []
    scripts = [_msg("end_turn", [_txt("Hello "), _txt("world")])]
    agent = Hermes(client=_fake_client(scripts), on_text=chunks.append)
    reply = agent.send("hi")
    assert "".join(chunks) == "Hello world"
    assert reply == "Hello world"


def test_refusal_is_handled():
    scripts = [_msg("refusal", [])]
    agent = Hermes(client=_fake_client(scripts))
    reply = agent.send("...")
    assert "declined" in reply.lower()


def _run_all():
    tests = [v for k, v in sorted(globals().items())
             if k.startswith("test_") and callable(v)]
    for test in tests:
        test()
        print(f"  ok  {test.__name__}")
    print(f"\n{len(tests)} passed")


if __name__ == "__main__":
    _run_all()
