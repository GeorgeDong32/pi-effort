# pi-effort

Small Pi extension for controlling thinking/effort from inside a Pi session.

## Goal

Provide a simple `/effort` command for:

- showing the current thinking level
- changing the current session thinking level
- setting a persistent default thinking level

Planned command surface:

```text
/effort show
/effort off
/effort minimal
/effort low
/effort medium
/effort high
/effort xhigh
/effort default <off|minimal|low|medium|high|xhigh>
```

## Status

This repository is currently a scaffold. The extension entrypoint exists, but
the `/effort` command implementation is not added yet.

## Install

### From Git

```bash
pi install git:github.com/ricardofrantz/pi-effort
```

### Local development

```bash
npm install
```

Then load it from a local checkout:

```bash
pi --extension ./index.ts
```

## Repo structure

```text
index.ts        Pi extension entrypoint
package.json    Package metadata and Pi manifest
tsconfig.json   TypeScript configuration
```

## License

Apache-2.0
