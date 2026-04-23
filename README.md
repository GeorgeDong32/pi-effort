# pi-effort

Small Pi extension for controlling thinking/effort from inside a Pi session.

`pi-effort` adds a simple `/effort` command to Pi so you can:

- inspect the current session thinking level
- see which effort levels the current model actually supports
- change the current session effort without restarting Pi
- set or clear the default effort for future sessions

## Commands

```text
/effort
/effort show
/effort options
/effort off
/effort minimal
/effort low
/effort medium
/effort high
/effort xhigh
/effort default off
/effort default minimal
/effort default low
/effort default medium
/effort default high
/effort default xhigh
/effort default clear
```

## What It Does

- `/effort` or `/effort show` shows the current session effort and the persisted
  default effort, plus the Pi-level effort options available for the current model.
- `/effort options` shows only the Pi-level effort options available for the
  current model.
- `/effort <level>` changes the current session thinking level.
- `/effort default <level>` changes the default thinking level for future
  sessions by editing `~/.pi/agent/settings.json`.
- `/effort default clear` removes the persisted default.

New sessions automatically pick up `defaultThinkingLevel` from Pi's own
session/runtime initialization path. `pi-effort` does not add a separate
`session_start` hook for this because Pi core already applies the default.

## Examples

```text
/effort show
```

Shows:

```text
current=<level> | default=<level-or-unset> | available=<levels>
```

```text
/effort high
```

Changes the current session effort to `high`.

```text
/effort default xhigh
```

Sets the default effort for future Pi sessions to `xhigh`.

```text
/effort default clear
```

Removes the persisted default.

## Model-Specific Options

`pi-effort` follows Pi's own model-level thinking granularity:

- non-reasoning models: `off`
- reasoning models: `off, minimal, low, medium, high`
- xhigh-capable models in Pi:
  - `gpt-5.2*`
  - `gpt-5.3*`
  - `gpt-5.4*`
  - `opus-4.6*`
  - `opus-4.7*`

Important: this is Pi-level effort, not raw provider-native labels. For example,
Anthropic may internally map Pi's `xhigh` to a provider-specific maximum effort,
but the extension surface remains Pi's standard thinking levels.

## Install

### From Git

```bash
pi install git:github.com/ricardofrantz/pi-effort
```

Then reload Pi resources:

```bash
/reload
```

### Local development

```bash
npm install
```

Then load it from a local checkout:

```bash
pi --extension ./index.ts
```

## Verification

```bash
npm run check
npm test
```

## Why This Exists

Pi already has thinking-level controls, but they are not exposed as a small,
focused slash command for daily use. `pi-effort` makes that workflow explicit:

- one command to inspect session/default effort
- one command to change the current session
- one command to set the next-session default

## Repo Structure

```text
index.ts        Pi extension entrypoint
effort.ts       Parsing and settings helpers
tests/          Unit and runtime tests
package.json    Package metadata and Pi manifest
tsconfig.json   TypeScript configuration
```

## License

Apache-2.0
