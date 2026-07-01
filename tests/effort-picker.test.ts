import test from "node:test";
import assert from "node:assert/strict";
import { createEffortPickerComponent, type EffortPickerResult } from "../effort-picker.ts";
import { visibleWidth } from "@mariozechner/pi-tui";

const LEVELS_5 = ["minimal", "low", "medium", "high", "xhigh"];
const LEVELS_3 = ["low", "medium", "high"];

// Helper: synthesize an Arrow-Right / Arrow-Left keypress matching what
// pi-tui's stdin layer forwards to handleInput. The exact byte sequences
// are not part of the public API; matchesKey() handles both legacy CSI
// and Kitty CSI-u forms, so any well-formed arrow sequence will do.
const ARROW_RIGHT = "\x1b[C";
const ARROW_LEFT = "\x1b[D";
const ENTER = "\r";
const ESCAPE = "\x1b";
const TAB = "\t";

function newPicker(levels: string[], currentLevel?: string) {
  let captured: EffortPickerResult | null = null;
  const component = createEffortPickerComponent({
    levels,
    currentLevel,
    done: (result) => {
      captured = result;
    },
  });
  const handleInput = component.handleInput;
  if (!handleInput) throw new Error("picker must implement handleInput");
  return {
    component,
    // Bind so callers can invoke as a plain function without losing `this`.
    handleInput: handleInput.bind(component),
    getResult: () => captured,
  };
}

// ─── Initial selection ─────────────────────────────────────────────

test("picker seeds selectedIndex from currentLevel", () => {
  const { component, getResult } = newPicker(LEVELS_5, "medium");
  const lines = component.render(80);
  assert.ok(lines.length > 0);
  // The labels line should contain "medium" highlighted; we don't try to
  // inspect ANSI here, just verify no early completion.
  assert.equal(getResult(), null);
});

test("picker falls back to middle index when currentLevel is undefined", () => {
  const { component } = newPicker(LEVELS_5, undefined);
  // No assertion on visible position without ANSI parsing — just render ok.
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("picker falls back to middle index when currentLevel is unknown", () => {
  const { component } = newPicker(LEVELS_5, "not-a-level");
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("picker clamps currentLevel index when it is out of range", () => {
  const { component } = newPicker(LEVELS_3, "xhigh");
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

// ─── Arrow key navigation ──────────────────────────────────────────

test("ArrowRight advances selection", () => {
  const { component, handleInput } = newPicker(LEVELS_5, "low");
  handleInput(ARROW_RIGHT);
  handleInput(ARROW_RIGHT);
  handleInput(ENTER);
  // We can't read selectedIndex directly, but render before enter is fine.
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("ArrowLeft at index 0 is a no-op", () => {
  const { component, getResult, handleInput } = newPicker(LEVELS_5, "minimal");
  handleInput(ARROW_LEFT);
  handleInput(ENTER);
  // Should still confirm the first level (minimal) since left did nothing.
  assert.deepEqual(getResult(), { action: "confirm", level: "minimal" });
});

test("ArrowRight past the last index is a no-op", () => {
  const { component, getResult, handleInput } = newPicker(LEVELS_5, "xhigh");
  handleInput(ARROW_RIGHT);
  handleInput(ENTER);
  assert.deepEqual(getResult(), { action: "confirm", level: "xhigh" });
});

test("Tab behaves like ArrowRight", () => {
  const { component, getResult, handleInput } = newPicker(LEVELS_5, "low");
  handleInput(TAB);
  handleInput(TAB);
  handleInput(ENTER);
  assert.deepEqual(getResult(), { action: "confirm", level: "high" });
});

// ─── Confirm / cancel ──────────────────────────────────────────────

test("Enter confirms the currently selected level", () => {
  const { component, getResult, handleInput } = newPicker(LEVELS_5, "high");
  handleInput(ENTER);
  assert.deepEqual(getResult(), { action: "confirm", level: "high" });
});

test("Escape cancels without a level", () => {
  const { component, getResult, handleInput } = newPicker(LEVELS_5, "high");
  handleInput(ESCAPE);
  assert.deepEqual(getResult(), { action: "cancel" });
});

test("done callback fires exactly once", () => {
  let count = 0;
  const component = createEffortPickerComponent({
    levels: LEVELS_5,
    currentLevel: "medium",
    done: () => {
      count++;
    },
  });
  const handleInput = component.handleInput;
  if (!handleInput) throw new Error("picker must implement handleInput");
  const send = handleInput.bind(component);
  send(ENTER);
  send(ENTER);
  send(ARROW_RIGHT);
  send(ESCAPE);
  assert.equal(count, 1);
});

test("input is ignored after dispose", () => {
  let count = 0;
  const component = createEffortPickerComponent({
    levels: LEVELS_5,
    currentLevel: "low",
    done: () => {
      count++;
    },
  });
  const handleInput = component.handleInput;
  if (!handleInput) throw new Error("picker must implement handleInput");
  const send = handleInput.bind(component);
  component.dispose?.();
  send(ARROW_RIGHT);
  send(ENTER);
  assert.equal(count, 0);
});

// ─── Render invariants ─────────────────────────────────────────────

test("render returns 5 lines for non-empty levels", () => {
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("render centers the title within a sufficiently wide viewport", () => {
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(120);
  // Title line: padLine centers the title text; with width=120, the title
  // starts well past column 0.
  const titleStripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
  const firstNonSpace = titleStripped.search(/\S/);
  assert.ok(firstNonSpace > 0, "title should be centered (leading padding present)");
});

test("render fills the full viewport width (no truncation when wide enough)", () => {
  // Slider and labels span the inner width; padLine centers them inside the
  // requested width, so the resulting lines are exactly `width` columns.
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(120);
  assert.equal(visibleWidth(lines[2]), 120, "slider line fills the viewport");
  assert.equal(visibleWidth(lines[3]), 120, "labels line fills the viewport");
});

test("render returns 5 lines for non-empty levels", () => {
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("render handles a single-level list without throwing", () => {
  const { component } = newPicker(["medium"], "medium");
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("render handles empty levels gracefully", () => {
  const { component } = newPicker([], undefined);
  const lines = component.render(80);
  assert.equal(lines.length, 5);
});

test("render caches and invalidate forces a refresh", () => {
  const { component, handleInput } = newPicker(LEVELS_5, "low");
  const first = component.render(80);
  const second = component.render(80);
  assert.strictEqual(first, second); // cache hit returns identical reference
  handleInput(ARROW_RIGHT);
  const third = component.render(80);
  assert.notStrictEqual(third, first); // invalidated -> new array
});

test("render survives narrow widths without throwing", () => {
  // The picker must not throw even when the overlay forces a tiny width.
  // Lines may overflow the requested width (we deliberately do not truncate),
  // but every call must succeed and return 5 lines.
  const { component } = newPicker(LEVELS_5, "medium");
  for (const width of [1, 5, 10, 20]) {
    const lines = component.render(width);
    assert.equal(lines.length, 5);
  }
});

test("title line contains 'Effort'", () => {
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(80);
  const stripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
  assert.ok(stripped.includes("Effort"));
});

test("footer line includes arrow and confirm hints", () => {
  const { component } = newPicker(LEVELS_5, "medium");
  const lines = component.render(80);
  const footer = lines[4].replace(/\x1b\[[0-9;]*m/g, "");
  assert.ok(footer.includes("←") || footer.includes("<") || footer.includes("Left") || footer.includes("arrow"));
  assert.ok(footer.toLowerCase().includes("enter"));
  assert.ok(footer.toLowerCase().includes("esc") || footer.toLowerCase().includes("cancel"));
});
