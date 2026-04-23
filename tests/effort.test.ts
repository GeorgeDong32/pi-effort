import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatUsage,
  getAvailableThinkingLevels,
  getDefaultThinkingLevel,
  parseEffortCommand,
  supportsXhighThinking,
  writeDefaultThinkingLevel,
} from "../effort.ts";

test("parseEffortCommand handles show and current-session levels", () => {
  assert.deepEqual(parseEffortCommand(""), { kind: "show" });
  assert.deepEqual(parseEffortCommand("show"), { kind: "show" });
  assert.deepEqual(parseEffortCommand("options"), { kind: "options" });
  assert.deepEqual(parseEffortCommand("xhigh"), { kind: "set-session", level: "xhigh" });
});

test("parseEffortCommand handles default persistence commands", () => {
  assert.deepEqual(parseEffortCommand("default high"), { kind: "set-default", level: "high" });
  assert.deepEqual(parseEffortCommand("default clear"), { kind: "set-default", level: null });
});

test("parseEffortCommand rejects invalid input", () => {
  assert.throws(() => parseEffortCommand("banana"), /Unknown effort command/);
  assert.throws(() => parseEffortCommand("default banana"), /Unknown default thinking level/);
});

test("writeDefaultThinkingLevel preserves unrelated settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-effort-"));
  const settingsPath = join(dir, "settings.json");
  writeFileSync(settingsPath, JSON.stringify({ defaultProvider: "openrouter" }, null, 2));

  writeDefaultThinkingLevel(settingsPath, "high");

  const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  assert.equal(parsed.defaultProvider, "openrouter");
  assert.equal(parsed.defaultThinkingLevel, "high");
  assert.equal(getDefaultThinkingLevel(settingsPath), "high");
});

test("writeDefaultThinkingLevel can clear the persisted default", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-effort-"));
  const settingsPath = join(dir, "settings.json");
  writeFileSync(settingsPath, JSON.stringify({ defaultThinkingLevel: "xhigh" }, null, 2));

  writeDefaultThinkingLevel(settingsPath, null);

  const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  assert.equal("defaultThinkingLevel" in parsed, false);
  assert.equal(getDefaultThinkingLevel(settingsPath), undefined);
});

test("formatUsage includes the slash command", () => {
  assert.match(formatUsage(), /\/effort/);
});

test("supportsXhighThinking matches Pi-level gpt-5.4 and opus-4.6 families", () => {
  assert.equal(supportsXhighThinking({ id: "gpt-5.4", reasoning: true }), true);
  assert.equal(supportsXhighThinking({ id: "claude-opus-4.6", reasoning: true }), true);
  assert.equal(supportsXhighThinking({ id: "minimax/minimax-m2.7", reasoning: true }), false);
});

test("getAvailableThinkingLevels reflects reasoning and xhigh support", () => {
  assert.deepEqual(getAvailableThinkingLevels({ id: "plain-model", reasoning: false }), ["off"]);
  assert.deepEqual(getAvailableThinkingLevels({ id: "minimax/minimax-m2.7", reasoning: true }), [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
  ]);
  assert.deepEqual(getAvailableThinkingLevels({ id: "gpt-5.4", reasoning: true }), [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ]);
});
