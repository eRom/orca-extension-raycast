import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrcaCliError } from "../src/lib/orca-cli";
import { type Bot, launchArgs, parseBotList, readBotFolders, sortBots } from "../src/lib/bots";

const makeBot = (overrides: Partial<Bot>): Bot => ({
  id: "id",
  name: "Bot",
  harness: "claude",
  specialty: "",
  paused: false,
  folder: "/h/.orca/bots/bot",
  ...overrides,
});

describe("readBotFolders", () => {
  test("readBotFolders maps bot.json id to folder", () => {
    const tmp = mkdtempSync(join(tmpdir(), "orca-bots-"));
    mkdirSync(join(tmp, "a"));
    writeFileSync(join(tmp, "a", "bot.json"), JSON.stringify({ id: "id-a" }));
    mkdirSync(join(tmp, "b"));
    writeFileSync(join(tmp, "b", "bot.json"), "{ not json");
    mkdirSync(join(tmp, "c"));

    const folders = readBotFolders(tmp);
    expect(folders.size).toBe(1);
    expect(folders.get("id-a")).toBe(join(tmp, "a"));
  });

  test("readBotFolders returns an empty map when the directory does not exist", () => {
    expect(readBotFolders(join(tmpdir(), "orca-bots-does-not-exist-xyz")).size).toBe(0);
  });

  test("readBotFolders ignores a bot.json without a string id", () => {
    const tmp = mkdtempSync(join(tmpdir(), "orca-bots-"));
    mkdirSync(join(tmp, "a"));
    writeFileSync(join(tmp, "a", "bot.json"), JSON.stringify({ id: 42 }));
    mkdirSync(join(tmp, "b"));
    writeFileSync(join(tmp, "b", "bot.json"), "null");
    expect(readBotFolders(tmp).size).toBe(0);
  });
});

describe("parseBotList", () => {
  test("parseBotList keeps all fields and resolves folders", () => {
    const envelope = JSON.parse(readFileSync(join(__dirname, "fixtures", "bot-list.json"), "utf8"));
    const folders = new Map([["b4201eff-cb3e-45fe-ae11-f29318e646f5", "/h/.orca/bots/test"]]);

    const bots = parseBotList(envelope.result, folders);
    expect(bots).toHaveLength(4);

    const test_ = bots.find((bot) => bot.name === "test");
    expect(test_?.folder).toBe("/h/.orca/bots/test");
    expect(test_?.harness).toBe("claude");
    expect(test_?.paused).toBe(false);
    expect(test_?.specialty).toBe("sdfsdf");

    const denree = bots.find((bot) => bot.name === "LaDenrée");
    expect(denree?.harness).toBe("grok");
    expect(denree?.folder).toBeNull();
  });

  test("parseBotList tolerates unexpected shapes", () => {
    for (const value of [null, undefined, 42, "x", {}, { bots: null }, { bots: [null, 1, {}] }]) {
      expect(parseBotList(value, new Map())).toEqual([]);
    }
  });
});

describe("sortBots", () => {
  test("sortBots puts last used first then paused last", () => {
    const a = makeBot({ id: "a", name: "A" });
    const b = makeBot({ id: "b", name: "B", paused: true });
    const c = makeBot({ id: "c", name: "C" });
    expect(sortBots([b, a, c], "c").map((bot) => bot.id)).toEqual(["c", "a", "b"]);
  });

  test("sortBots orders alphabetically without a last used bot and does not mutate its input", () => {
    const input = [makeBot({ id: "z", name: "Zoé" }), makeBot({ id: "e", name: "Émile" }), makeBot({ id: "a", name: "Alice" })];
    const snapshot = input.map((bot) => bot.id);
    expect(sortBots(input).map((bot) => bot.id)).toEqual(["a", "e", "z"]);
    expect(input.map((bot) => bot.id)).toEqual(snapshot);
  });

  test("sortBots keeps a paused last used bot first", () => {
    const a = makeBot({ id: "a", name: "A" });
    const b = makeBot({ id: "b", name: "B", paused: true });
    expect(sortBots([a, b], "b").map((bot) => bot.id)).toEqual(["b", "a"]);
  });
});

describe("launchArgs", () => {
  test("launchArgs builds the probed command", () => {
    const bot = makeBot({ harness: "claude", folder: "/h/.orca/bots/test" });
    expect(launchArgs(bot, "Réponds juste: pong")).toEqual([
      "agent",
      "launch",
      "--agent",
      "claude",
      "--worktree",
      "path:/h/.orca/bots/test",
      "--surface",
      "chat",
      "--prompt=Réponds juste: pong",
    ]);
  });

  // Le parseur d'Orca prend le jeton suivant `--prompt` pour un flag s'il commence par `--` :
  // seule la forme `--prompt=<valeur>` en un seul argument est sûre.
  test("launchArgs keeps a prompt starting with -- in a single --prompt= argument", () => {
    const prompt = "---\ntitle: x\n---";
    const args = launchArgs(makeBot({}), prompt);
    expect(args.at(-1)).toBe(`--prompt=${prompt}`);
    expect(args).not.toContain("--prompt");
    expect(args).not.toContain(prompt);
  });

  test("launchArgs keeps equals signs of the prompt intact", () => {
    expect(launchArgs(makeBot({}), "a=b").at(-1)).toBe("--prompt=a=b");
  });

  test("launchArgs never includes --focus", () => {
    expect(launchArgs(makeBot({}), "x")).not.toContain("--focus");
  });

  test("launchArgs refuses a bot without a resolved folder", () => {
    const bot = makeBot({ folder: null });
    let caught: unknown;
    try {
      launchArgs(bot, "hello");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(OrcaCliError);
    expect((caught as OrcaCliError).code).toBe("bot_folder_missing");
    expect((caught as OrcaCliError).message.length).toBeGreaterThan(0);
  });
});
