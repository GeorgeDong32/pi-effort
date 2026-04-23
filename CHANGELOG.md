# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.0.2] - 2026-04-23

### Added

- `/effort min` and `/effort max` — model-adaptive semantic aliases that resolve to the lowest/highest reasoning level for the current model
- `/effort default min` and `/effort default max` — set persistent defaults using the resolved level
- `Ctrl+Shift+E` keyboard shortcut to cycle through available effort levels
- `--effort` CLI flag (e.g., `pi --effort max`) to set initial effort on session start
- `session_start` hook — sets footer status and applies `--effort` flag on startup
- `model_select` hook — clamps effort when switching to a model with a lower max, with warning notification
- `cycleLevel()` — cycles through user-facing levels (powers the keyboard shortcut)
- `getUserFacingLevels()` — returns available levels excluding `off` for display/completion
- Typo suggestions using Levenshtein distance on invalid commands
- Atomic settings write (temp file + rename) to prevent partial writes and race conditions
- `getDefaultThinkingLevel()` safely returns `undefined` on corrupt/unreadable settings.json instead of crashing
- Pre-validation of effort level against model capabilities before calling `pi.setThinkingLevel()` — unsupported levels are rejected with a clear error instead of silently clamped

### Changed

- `buildShowMessage` is now a pure function (no disk reads; default level passed as parameter)
- `formatUsage()` function replaced with `USAGE` constant
- `off` is accepted for backward compat but hidden from the primary user surface — use `min` instead
- Tab completion now shows `min`/`max` alongside explicit levels
- README rewritten to document min/max, shortcuts, CLI flag, and model switching behavior

### Removed

- Silent clamping of effort levels (replaced with explicit rejection + error message)
- `formatUsage()` function (replaced by `USAGE` constant)
