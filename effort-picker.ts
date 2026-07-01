import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Key, matchesKey, visibleWidth } from "@mariozechner/pi-tui";

/**
 * Result returned when the user finishes interacting with the effort picker.
 * `level` is set only when action is "confirm".
 */
export interface EffortPickerResult {
  action: "confirm" | "cancel";
  level?: string;
}

/**
 * Options for constructing the picker component.
 */
export interface EffortPickerOptions {
  /** Ordered list of effort levels supported by the current model. */
  levels: string[];
  /** Currently active level, used to seed the initial cursor position. */
  currentLevel: string | undefined;
  /** Theme used for styling (bold/inverse/fg). Optional; falls back to plain text. */
  theme?: Theme;
  /** Completion callback invoked exactly once. */
  done: (result: EffortPickerResult) => void;
}

const TITLE = "Effort";
const FOOTER = "←/→ to adjust · Enter to confirm · Esc to cancel";
// Outer padding inside the overlay (kept for backwards compatibility) plus
// the per-end inset applied to the label row so the leftmost/rightmost label
// never collides with the overlay border.
const HORIZONTAL_PAD = 0;
const END_INSET = 2; // columns reserved at each end of the slider/labels row
const MIN_INNER_WIDTH = 28;

/**
 * Build a horizontal-selector component for /effort.
 *
 * Render shape (5 lines, when levels has at least 2 entries):
 *
 *   Effort
 *
 *   ────────────────▲────────────────────────────────────────
 *   minimal  low  medium  high  xhigh
 *
 *   ←/→ to adjust · Enter to confirm · Esc to cancel
 *
 * The labels span from the leftmost column to the rightmost column so the
 * strongest available level is always flush against the right edge — no
 * trailing whitespace. The slider `▲` sits above the currently highlighted
 * label; arrow keys move it.
 */
export function createEffortPickerComponent(options: EffortPickerOptions): Component & { dispose?(): void } {
  return new EffortPickerComponent(options);
}

class EffortPickerComponent implements Component {
  private levels: string[];
  private selectedIndex: number;
  private theme: Theme | undefined;
  private done: (result: EffortPickerResult) => void;
  private cachedLines: string[] | undefined;
  private cachedWidth: number | undefined;
  private disposed = false;

  constructor(options: EffortPickerOptions) {
    this.levels = options.levels;
    this.theme = options.theme;
    this.done = options.done;

    // Seed cursor: prefer current level, fall back to middle of the available range.
    let initial = options.currentLevel ? this.levels.indexOf(options.currentLevel) : -1;
    if (initial < 0) {
      initial = Math.max(0, Math.floor(this.levels.length / 2));
    }
    if (initial >= this.levels.length) {
      initial = Math.max(0, this.levels.length - 1);
    }
    this.selectedIndex = initial;
  }

  handleInput(data: string): void {
    if (this.disposed) return;

    if (matchesKey(data, Key.left)) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.invalidate();
      }
      return;
    }

    if (matchesKey(data, Key.right) || matchesKey(data, Key.tab)) {
      if (this.selectedIndex < this.levels.length - 1) {
        this.selectedIndex++;
        this.invalidate();
      }
      return;
    }

    if (matchesKey(data, Key.enter)) {
      this.finish({ action: "confirm", level: this.levels[this.selectedIndex] });
      return;
    }

    if (matchesKey(data, Key.escape)) {
      this.finish({ action: "cancel" });
      return;
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = this.computeLines(width);
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  dispose(): void {
    this.disposed = true;
  }

  private finish(result: EffortPickerResult): void {
    if (this.disposed) return;
    this.disposed = true;
    this.done(result);
  }

  private computeLines(width: number): string[] {
    // Title and footer are centered across the full viewport; the slider and
    // labels row is centered too but reserves `END_INSET` columns on each
    // side so the leftmost/rightmost label never touches the overlay border.
    const innerWidth = Math.max(MIN_INNER_WIDTH, width - HORIZONTAL_PAD * 2);
    const pad = (line: string): string => padLine(line, width);
    const dim = (text: string): string => this.theme?.fg("dim", text) ?? text;
    const inverse = (text: string): string => this.theme?.inverse(text) ?? text;
    const bold = (text: string): string => this.theme?.bold(text) ?? text;
    const muted = (text: string): string => this.theme?.fg("muted", text) ?? text;

    const title = pad(bold(this.theme?.fg("accent", TITLE) ?? TITLE));

    if (this.levels.length === 0) {
      return [title, pad(""), pad(muted("No effort levels available for this model.")), pad(""), pad(dim(FOOTER))];
    }

    if (this.levels.length === 1) {
      const only = inverse(bold(this.levels[0]));
      const ruler = pad("▲");
      const labels = pad(only);
      return [title, pad(""), ruler, labels, pad(dim(FOOTER))];
    }

    // Layout labels within the inner width, with END_INSET columns of margin
    // reserved at each end. This keeps the slider visually contained inside
    // the overlay border even when levels are short.
    const trackWidth = Math.max(this.levels.length * 2, innerWidth - END_INSET * 2);
    const positions = layoutLabelPositions(this.levels, trackWidth, END_INSET);
    // Slider and labels rows share the same total length (= trackWidth + 2*END_INSET)
    // so padLine centers them together and they line up visually.
    const rowWidth = trackWidth + END_INSET * 2;
    const sliderLine = buildSliderLine(positions, this.selectedIndex, rowWidth, END_INSET, muted);
    const labelsLine = buildLabelsLine(this.levels, positions, this.selectedIndex, inverse, bold);

    return [title, pad(""), pad(sliderLine), pad(labelsLine), pad(dim(FOOTER))];
  }
}

/**
 * Compute the column where the *center* of each label sits.
 *
 * Levels are spread across `trackWidth` columns starting at column `inset`.
 * Intermediate labels are linearly interpolated between the endpoints, so
 * the leftmost label is `inset` cells from the start and the rightmost is
 * `trackWidth - 1 + inset` cells in. With a positive `inset` the slider
 * stays clear of the overlay border.
 */
function layoutLabelPositions(levels: string[], trackWidth: number, inset = 0): number[] {
  const n = levels.length;
  if (n === 1) return [Math.floor(trackWidth / 2) + inset];
  const positions: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    positions[i] = inset + Math.round((i * (trackWidth - 1)) / (n - 1));
  }
  return positions;
}

function buildSliderLine(
  positions: number[],
  selectedIndex: number,
  rowWidth: number,
  inset: number,
  muted: (text: string) => string
): string {
  const char = muted("─");
  const caret = "▲";
  // Build a column array of single-cell characters, then place the caret at
  // the selected position. Both endpoints are reserved by `inset` columns of
  // ─ to keep the caret from ever rendering at column 0 / rowWidth-1.
  const cols: string[] = new Array(rowWidth).fill(char);
  const caretCol = positions[selectedIndex];
  if (caretCol >= 0 && caretCol < rowWidth) {
    cols[caretCol] = caret;
  }
  void inset;
  return cols.join("");
}

function buildLabelsLine(
  levels: string[],
  positions: number[],
  selectedIndex: number,
  inverse: (text: string) => string,
  bold: (text: string) => string
): string {
  // Size the buffer to cover the rightmost label end + the END_INSET margin
  // (if any). Allocating a generous buffer keeps the splice-based styled
  // label replacement simple.
  const innerWidth = positions[positions.length - 1] + END_INSET + 1;
  // Each label is rendered as a sequence of visible-width cells centered on its position.
  // We track used columns to avoid overlap.
  const cols: string[] = new Array(innerWidth).fill(" ");
  const labelWidths = levels.map((l) => visibleWidth(l));

  // First pass: fill unselected labels into the column buffer (left-to-right).
  for (let i = 0; i < levels.length; i++) {
    if (i === selectedIndex) continue;
    const center = positions[i];
    const w = labelWidths[i];
    const start = center - Math.floor(w / 2);
    writeInto(cols, levels[i], start);
  }

  // Second pass: overwrite with the selected label, styled.
  const selectedLabel = levels[selectedIndex];
  const styled = inverse(bold(selectedLabel));
  const center = positions[selectedIndex];
  const w = labelWidths[selectedIndex];
  const start = center - Math.floor(w / 2);
  // We need to write styled text but the surrounding cols are plain strings.
  // Use a sparse buffer: collect segments.
  // For simplicity here, since inverse styling is applied to plain ASCII labels,
  // the visible width still equals labelWidths[selectedIndex]. We can splice the
  // styled string into the plain-text column buffer by replacing the slice.
  cols.splice(start, w, styled);

  return cols.join("");
}

/**
 * Write `text` into `cols` starting at column `start`, padding with spaces
 * if `start` is negative or the text overruns the buffer.
 */
function writeInto(cols: string[], text: string, start: number): void {
  const w = visibleWidth(text);
  for (let i = 0; i < w; i++) {
    const target = start + i;
    if (target < 0) continue;
    if (target >= cols.length) break;
    cols[target] = text[i] ?? " ";
  }
}

/**
 * Center `line` (visible-width aware) within `width` by padding with spaces.
 * If the line is already wider than `width`, return it unchanged so the
 * overlay layer can decide how to handle overflow rather than silently
 * truncating content (which would clip the right-hand labels).
 */
function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return line;
  const totalPad = width - vw;
  const left = Math.floor(totalPad / 2);
  const right = totalPad - left;
  return " ".repeat(left) + line + " ".repeat(right);
}
