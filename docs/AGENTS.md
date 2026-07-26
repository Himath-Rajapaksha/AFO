# AGENTS.md

## Project

**AFO — Advanced File Organizer (v3.x, Tauri Edition).** Cross-platform desktop app for rule-based file organization, duplicate detection, batch rename, and metadata-aware sorting. Complete rewrite from Python/tkinter to Tauri.

## Current State

Production app with active feature development. Current pre-release version: `3.3.1-beta`. See `CHANGELOG.md` for full version history and `VERSIONING.md` for versioning policy (MAJOR.FEATURE.DEBUG format).

## Tech Stack

- **Backend:** Tauri v2 + Rust (async Tokio runtime)
- **Frontend:** React 18 + TypeScript, Vite 5, Tailwind CSS 3.4
- **Key crates:** `blake3` (hashing), `rayon` (parallelism), `notify` (fs watching), `rusqlite` (undo journal), `kamadak-exif` + `lofty` (metadata), `tokio-cron-scheduler` (scheduling), `tauri-plugin-updater` (auto-updates)
- **Key frontend deps:** Framer Motion, React Flow (rule builder), Zustand (state), react-i18next (localization), lucide-react (icons)

## Before Making Changes

- Run `npx tsc --noEmit` for TypeScript type checking
- Run `cargo check` for Rust compilation
- Run `npm run lint` for ESLint
- Follow the versioning policy in `VERSIONING.md` — do not bump version numbers for test builds
- Maintain `docs/Project_Log.md` — append-only development log

## Rules

1. **Project Log** — Maintain `docs/Project_Log.md` for every development session. Log every test, commit, push, code change, debugging attempt, and architectural decision. Never delete or overwrite prior log entries — append only.
2. **Commit Every Change** — Every meaningful change must be committed and pushed. Use `gh` to interact with the GitHub repo. Follow conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
3. **Version Policy** — Follow `VERSIONING.md` (MAJOR.FEATURE.DEBUG format). A version number changes once per actual release. Test/verification builds use pre-release suffixes (`-beta.N`). Bump FEATURE for new features, DEBUG for bug fixes, MAJOR for breaking changes.
4. **Change Log** — Update `CHANGELOG.md` with every real release. Add entries for the `[Unreleased]` section as features land.
5. **Project Rules** — See `project_rules.md` for project-specific conventions and gotchas.

## Gotchas

- Undo/redo journal must persist to `~/.local/share/afo/journal.db` (SQLite). Operations must write journal entries **before** reporting success.
- Duplicate detection uses `blake3`, not MD5/SHA.
- Real-time file watching is **opt-in per directory**, not global. Debounce window is 300ms.
- Recursive scanning has a hard depth cap (default 5). Don't remove it.
- Rule engine uses AND logic for conditions, sequential actions. Rules are JSON-serialized.
- Symlinks require elevated privileges on Windows. Don't assume cross-platform symlink availability.
- Version strings must be consistent across: `package.json`, `Cargo.toml`, `tauri.conf.json`, `en.json`, `SettingsPanel.tsx`.
- i18n uses per-key namespaces from `en.json` — each top-level key is its own namespace.
