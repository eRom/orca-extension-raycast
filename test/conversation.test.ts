import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Conversation, isAnswered, latestReply, parseConversation } from "../src/lib/conversation";

const loadResult = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")).result;

describe("parseConversation", () => {
  test("missing state is never done", () => {
    const conv = parseConversation(loadResult("agent-read-no-state.json"));
    expect(conv.state).toBe("unknown");
    expect(latestReply(conv)).toBeNull();
    expect(isAnswered(conv)).toBe(false);
  });

  test("done conversation exposes the reply", () => {
    const conv = parseConversation(loadResult("agent-read-done.json"));
    expect(conv.state).toBe("done");
    expect(isAnswered(conv)).toBe(true);
    expect(latestReply(conv)).toBe("pong");
  });

  test("working state is kept and is never answered", () => {
    const conv = parseConversation({
      state: "working",
      entries: [
        { kind: "message", role: "user", text: "q" },
        { kind: "message", role: "assistant", text: "partial" },
      ],
    });
    expect(conv.state).toBe("working");
    expect(isAnswered(conv)).toBe(false);
  });

  test("unknown state values fall back to unknown", () => {
    for (const state of ["blocked", "waiting", "future-state", 3, null]) {
      expect(parseConversation({ state, entries: [] }).state).toBe("unknown");
    }
  });

  test("keeps only non-empty message entries", () => {
    const conv = parseConversation({
      state: "done",
      entries: [
        { kind: "message", role: "user", text: "q" },
        { kind: "tool_call", role: "assistant", text: "ls" },
        { kind: "message", role: "assistant", text: "" },
        { kind: "message", role: "assistant" },
        { kind: "message", role: "assistant", text: "answer" },
        null,
        42,
      ],
    });
    expect(conv.entries).toEqual([
      { role: "user", text: "q" },
      { role: "assistant", text: "answer" },
    ]);
  });

  test("tolerates unexpected shapes", () => {
    for (const value of [null, undefined, 42, "x", {}, { entries: "nope" }]) {
      expect(parseConversation(value)).toEqual({ state: "unknown", entries: [] });
    }
  });
});

describe("latestReply", () => {
  test("reply before the last user message is not the answer", () => {
    const conv: Conversation = {
      state: "done",
      entries: [
        { role: "user", text: "first" },
        { role: "assistant", text: "old" },
        { role: "user", text: "second" },
      ],
    };
    expect(latestReply(conv)).toBeNull();
    expect(isAnswered(conv)).toBe(false);
  });

  test("returns the last assistant entry after the last user entry", () => {
    const conv: Conversation = {
      state: "done",
      entries: [
        { role: "user", text: "first" },
        { role: "assistant", text: "old" },
        { role: "user", text: "second" },
        { role: "assistant", text: "mid" },
        { role: "assistant", text: "final" },
      ],
    };
    expect(latestReply(conv)).toBe("final");
  });

  test("a done state without any assistant entry is not answered", () => {
    const conv: Conversation = { state: "done", entries: [{ role: "user", text: "q" }] };
    expect(isAnswered(conv)).toBe(false);
  });
});
