import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { supportsXhigh } from "@mariozechner/pi-ai";
import { Key } from "@mariozechner/pi-tui";
import {
  ALL_LEVELS,
  SEMANTIC_ALIASES,
  USER_LEVELS,
  USAGE,
  type EffortLevel,
  type EffortModel,
  cycleLevel,
  getAvailableThinkingLevels,
  getDefaultThinkingLevel,
  getUserFacingLevels,
  parseEffortCommand,
  resolveMaxLevel,
  resolveMinLevel,
  toThinkingLevel,
  writeDefaultThinkingLevel,
} from "./effort.js";

function buildShowMessage(
  current: string,
  defaultLevel: EffortLevel | undefined,
  model: EffortModel | null | undefined
): string {
  const defaultText = defaultLevel ?? "(unset)";
  const userLevels = getUserFacingLevels(model);
  const min = resolveMinLevel(model);
  const max = resolveMaxLevel(model);
  const parts = [`current=${current}`, `default=${defaultText}`, `available=${userLevels.join(",")}`];
  if (min && max) parts.push(`min=${min} max=${max}`);
  return `Effort: ${parts.join(" | ")}`;
}

function updateEffortStatus(ctx: ExtensionContext, current: string): void {
  ctx.ui.setStatus("effort", `effort:${current}`);
}

function applySessionLevel(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  level: EffortLevel
): void {
  const available = getAvailableThinkingLevels(ctx.model);
  if (!available.includes(level)) {
    ctx.ui.notify(
      `Model ${ctx.model?.id ?? "current model"} does not support ${level}. ` +
        `Available: ${getUserFacingLevels(ctx.model).join(", ")}`,
      "error"
    );
    return;
  }
  const before = pi.getThinkingLevel();
  pi.setThinkingLevel(toThinkingLevel(level) as Parameters<typeof pi.setThinkingLevel>[0]);
  const after = pi.getThinkingLevel();
  updateEffortStatus(ctx, after);
  ctx.ui.notify(`Effort changed: ${before} -> ${after}`, "info");
}

export default function effortExtension(pi: ExtensionAPI): void {
  // ─── Closure: track current model for tab completion ─────────────
  let currentModel: EffortModel | null = null;

  // ─── CLI flag ────────────────────────────────────────────────────
  pi.registerFlag("effort", {
    description: "Initial thinking effort level (min|max|minimal|low|medium|high|xhigh)",
    type: "string",
  });

  // ─── Keyboard shortcut: Ctrl+Shift+E to cycle effort ─────────────
  pi.registerShortcut(Key.ctrlShift("e"), {
    description: "Cycle effort level",
    handler: (ctx) => {
      const current = pi.getThinkingLevel();
      const next = cycleLevel(current, ctx.model);
      if (!next) {
        ctx.ui.notify("Thinking not available for this model", "warning");
        return;
      }
      pi.setThinkingLevel(toThinkingLevel(next) as Parameters<typeof pi.setThinkingLevel>[0]);
      const after = pi.getThinkingLevel();
      updateEffortStatus(ctx, after);
      ctx.ui.notify(`Effort: ${current} -> ${after}`, "info");
    },
  });

  // ─── session_start: set footer status + apply --effort flag ──────
  pi.on("session_start", (_event, ctx) => {
    // Track model for tab completion
    currentModel = ctx.model ?? null;
    // Show current effort in footer
    updateEffortStatus(ctx, pi.getThinkingLevel());

    // Apply --effort CLI flag if present
    const flagValue = pi.getFlag("effort");
    if (typeof flagValue === "string" && flagValue) {
      let resolved: EffortLevel | undefined;
      if (flagValue === "min") {
        resolved = resolveMinLevel(ctx.model);
      } else if (flagValue === "max") {
        resolved = resolveMaxLevel(ctx.model);
      } else if (ALL_LEVELS.includes(flagValue as EffortLevel)) {
        resolved = flagValue as EffortLevel;
      }

      if (!resolved) {
        ctx.ui.notify(`--effort ${flagValue}: thinking not available for ${ctx.model?.id ?? "current model"}`, "warning");
        return;
      }

      const available = getAvailableThinkingLevels(ctx.model);
      if (!available.includes(resolved)) {
        ctx.ui.notify(`--effort ${flagValue}: not supported by ${ctx.model?.id ?? "current model"}`, "warning");
        return;
      }

      pi.setThinkingLevel(toThinkingLevel(resolved) as Parameters<typeof pi.setThinkingLevel>[0]);
      updateEffortStatus(ctx, pi.getThinkingLevel());
    }
  });

  // ─── model_select: warn if current level exceeds new model's max ─
  pi.on("model_select", (event, ctx) => {
    // Track model for tab completion
    currentModel = event.model;
    const current = pi.getThinkingLevel();
    const available = getAvailableThinkingLevels(event.model);
    const userLevels = getUserFacingLevels(event.model);

    if (current !== "off" && !available.includes(current as EffortLevel)) {
      const max = resolveMaxLevel(event.model);
      if (max) {
        pi.setThinkingLevel(toThinkingLevel(max) as Parameters<typeof pi.setThinkingLevel>[0]);
        ctx.ui.notify(
          `Effort clamped: ${current} -> ${max} (model ${event.model.id} supports up to ${max})`,
          "warning"
        );
      } else {
        ctx.ui.notify(
          `Model ${event.model.id} does not support thinking. Effort was ${current}.`,
          "warning"
        );
      }
    }
    updateEffortStatus(ctx, pi.getThinkingLevel());
  });

  // ─── /effort command ─────────────────────────────────────────────
  pi.registerCommand("effort", {
    description: "Show or change thinking effort (min/max adapt per model)",
    getArgumentCompletions: (prefix) => {
      const value = prefix.trimStart();
      const tokens = value.split(/\s+/).filter(Boolean);
      const trailingSpace = /\s$/.test(value);

      // Build model-aware level list for completions
      const modelLevels: EffortLevel[] = currentModel?.reasoning
        ? supportsXhigh(currentModel as Parameters<typeof supportsXhigh>[0])
          ? [...USER_LEVELS]
          : USER_LEVELS.filter((l) => l !== "xhigh")
        : [];
      const modelAliases = currentModel?.reasoning ? [...SEMANTIC_ALIASES] : [];

      // Top-level completions: min, max (if reasoning), explicit levels (filtered), subcommands
      const topLevel = [...modelAliases, ...modelLevels, "show", "options", "default"];

      if (tokens.length === 0) {
        return topLevel.map((t) => ({ value: t, label: t }));
      }

      if (tokens.length === 1 && !trailingSpace) {
        return topLevel
          .filter((t) => t.startsWith(tokens[0]))
          .map((t) => ({ value: t, label: t }));
      }

      // "default" subcommand completions
      if (tokens[0] === "default") {
        const secondPrefix = trailingSpace ? "" : tokens[1] ?? "";
        const defaultOptions = [...modelAliases, ...modelLevels, "clear"];
        return defaultOptions
          .filter((t) => t.startsWith(secondPrefix))
          .map((t) => ({ value: `default ${t}`, label: t }));
      }

      return null;
    },
    handler: async (args, ctx) => {
      const settingsPath = join(getAgentDir(), "settings.json");

      let command;
      try {
        command = parseEffortCommand(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(message, "error");
        return;
      }

      switch (command.kind) {
        case "help":
          updateEffortStatus(ctx, pi.getThinkingLevel());
          ctx.ui.notify(USAGE, "info");
          return;

        case "options": {
          const userLevels = getUserFacingLevels(ctx.model);
          const min = resolveMinLevel(ctx.model);
          const max = resolveMaxLevel(ctx.model);
          updateEffortStatus(ctx, pi.getThinkingLevel());
          let msg = `Available effort for ${ctx.model?.id ?? "current model"}: ${userLevels.join(", ")}`;
          if (min && max) msg += ` (min=${min}, max=${max})`;
          ctx.ui.notify(msg, "info");
          return;
        }

        case "show": {
          const current = pi.getThinkingLevel();
          const defaultLevel = getDefaultThinkingLevel(settingsPath);
          updateEffortStatus(ctx, current);
          ctx.ui.notify(buildShowMessage(current, defaultLevel, ctx.model), "info");
          return;
        }

        case "set-session": {
          applySessionLevel(pi, ctx, command.level);
          return;
        }

        case "set-min": {
          const resolved = resolveMinLevel(ctx.model);
          if (!resolved) {
            ctx.ui.notify(`Thinking not available for ${ctx.model?.id ?? "current model"}`, "error");
            return;
          }
          applySessionLevel(pi, ctx, resolved);
          return;
        }

        case "set-max": {
          const resolved = resolveMaxLevel(ctx.model);
          if (!resolved) {
            ctx.ui.notify(`Thinking not available for ${ctx.model?.id ?? "current model"}`, "error");
            return;
          }
          applySessionLevel(pi, ctx, resolved);
          return;
        }

        case "set-default-min": {
          const resolved = resolveMinLevel(ctx.model);
          if (!resolved) {
            ctx.ui.notify(`Thinking not available for ${ctx.model?.id ?? "current model"}`, "error");
            return;
          }
          try {
            writeDefaultThinkingLevel(settingsPath, resolved);
          } catch (error) {
            ctx.ui.notify(`Failed to update default effort: ${error instanceof Error ? error.message : String(error)}`, "error");
            return;
          }
          ctx.ui.notify(`Default effort set to ${resolved} (min for ${ctx.model?.id ?? "current model"})`, "info");
          return;
        }

        case "set-default-max": {
          const resolved = resolveMaxLevel(ctx.model);
          if (!resolved) {
            ctx.ui.notify(`Thinking not available for ${ctx.model?.id ?? "current model"}`, "error");
            return;
          }
          try {
            writeDefaultThinkingLevel(settingsPath, resolved);
          } catch (error) {
            ctx.ui.notify(`Failed to update default effort: ${error instanceof Error ? error.message : String(error)}`, "error");
            return;
          }
          ctx.ui.notify(`Default effort set to ${resolved} (max for ${ctx.model?.id ?? "current model"})`, "info");
          return;
        }

        case "set-default":
          try {
            writeDefaultThinkingLevel(settingsPath, command.level);
          } catch (error) {
            ctx.ui.notify(`Failed to update default effort: ${error instanceof Error ? error.message : String(error)}`, "error");
            return;
          }
          if (command.level === null) {
            ctx.ui.notify("Default effort cleared for future sessions.", "info");
          } else {
            ctx.ui.notify(`Default effort set to ${command.level} for future sessions.`, "info");
          }
          return;
      }
    },
  });
}
