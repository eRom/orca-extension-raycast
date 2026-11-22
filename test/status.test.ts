import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStatus } from "../src/lib/status";

describe("parseStatus", () => {
  test("parseStatus reads the captured running status", () => {
    const envelope = JSON.parse(readFileSync(join(__dirname, "fixtures", "status-running.json"), "utf8"));
    expect(parseStatus(envelope.result)).toEqual({ running: true });
  });

  test("parseStatus is not running when the app is down", () => {
    expect(parseStatus({ app: { running: false } })).toEqual({ running: false });
  });

  test("parseStatus is not running when the runtime is unreachable", () => {
    expect(parseStatus({ app: { running: true }, runtime: { reachable: false } })).toEqual({ running: false });
  });

  test("parseStatus is not running on unexpected shapes", () => {
    for (const value of [null, undefined, 42, "x", {}, { app: null }]) {
      expect(parseStatus(value)).toEqual({ running: false });
    }
  });
});
