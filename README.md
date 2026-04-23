# pi-effort

Pi extension for controlling thinking/effort with model-adaptive `min`/`max` aliases.

## Goal

Provide a `/effort` command that adapts to the current model:

- `min` — set the lowest reasoning level for this model
- `max` — set the highest reasoning level for this model
- Explicit levels for fine-grained control
- Persistent defaults for future sessions

## Commands

```text
/effort            show current effort and available levels
/effort min        set minimum effort for this model
/effort max        set maximum effort for this model
/effort <level>    set explicit level (minimal|low|medium|high|xhigh)
/effort options    show available levels for this model
/effort default min|max|<level>
/effort default clear
```

### How min/max adapt per model

| Model type | `min` | `max` | Available levels |
|---|---|---|---|
| Non-reasoning | — | — | *(thinking unavailable)* |
| Reasoning (standard) | `minimal` | `high` | minimal, low, medium, high |
| Reasoning (xhigh-capable) | `minimal` | `xhigh` | minimal, low, medium, high, xhigh |

xhigh-capable models in Pi: `gpt-5.2*`, `gpt-5.3*`, `gpt-5.4*`, `opus-4.6*`, `opus-4.7*`.

### Defaults

- `/effort default max` — writes the resolved level (e.g., `xhigh`) to `~/.pi/agent/settings.json`. Future sessions pick it up automatically via Pi core.
- `/effort default clear` — removes the persisted default.

### Backward compat

`/effort off` still works but is not advertised in the primary surface. On reasoning models, use `min` instead — it's the same as `minimal` (the lowest reasoning level).

## Keyboard shortcut

`Ctrl+Shift+E` — cycle through available effort levels for the current model.

## CLI flag

```bash
pi --effort max       # start with maximum effort
pi --effort min       # start with minimum effort
pi --effort high      # start with explicit level
```

The flag resolves `min`/`max` against the initial model and applies the level on session start.

## Model switching

When you switch models (via `/model` or model selector), `pi-effort` automatically:

1. Checks if the current effort level exceeds the new model's maximum
2. Clamps it down and notifies you (e.g., `Effort clamped: xhigh -> high`)
3. Updates the footer status

## Install

```bash
pi install git:github.com/ricardofrantz/pi-effort
```

### Local development

```bash
npm install
pi --extension ./index.ts
```

## Verification

```bash
npm run check
npm test
```

## Repo structure

```text
index.ts        Pi extension entrypoint (hooks, commands, shortcuts)
effort.ts       Parsing, resolution, settings, and model capability logic
package.json    Package metadata and Pi manifest
tsconfig.json   TypeScript configuration
```

## License

Apache-2.0
