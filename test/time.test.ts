import { describe, expect, test } from "bun:test";
import { formatSince } from "../src/lib/time";

const NOW = 1_800_000_000_000;
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const since = (elapsedMs: number): string => formatSince(NOW - elapsedMs, NOW);

describe("formatSince", () => {
  test("says just now under one minute, without a depuis prefix", () => {
    expect(since(0)).toBe("à l'instant");
    expect(since(59 * SECOND)).toBe("à l'instant");
  });

  test("switches to minutes at 60 s", () => {
    expect(since(60 * SECOND)).toBe("depuis 1 min");
    expect(since(59 * MINUTE)).toBe("depuis 59 min");
  });

  test("switches to hours at 60 min", () => {
    expect(since(60 * MINUTE)).toBe("depuis 1 h");
    expect(since(23 * HOUR)).toBe("depuis 23 h");
  });

  test("switches to days at 24 h", () => {
    expect(since(24 * HOUR)).toBe("depuis 1 j");
    expect(since(50 * HOUR)).toBe("depuis 2 j");
  });

  test("truncates instead of rounding up", () => {
    expect(since(59 * MINUTE + 59 * SECOND)).toBe("depuis 59 min");
  });

  test("treats a start in the future as just now", () => {
    expect(since(-5 * MINUTE)).toBe("à l'instant");
  });
});
