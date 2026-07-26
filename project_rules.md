# Project Rules — AFO

Project-specific conventions, gotchas, and hard-won lessons. Read before making changes.

---

## Versioning

Follow `VERSIONING.md` at the repo root. Uses **MAJOR.FEATURE.DEBUG** format:

- **MAJOR** — Breaking changes (config format, OS support, API)
- **FEATURE** — New features (new panels, capabilities, UI additions)
- **DEBUG** — Bug fixes and minor improvements

Key rules:
- Version number changes **once per actual release**, not once per iteration
- Test builds use pre-release suffixes: `3.2.0-beta.1`, `3.2.0-beta.2`, etc.
- Version strings must be consistent across ALL of these locations:
  - `package.json` → `"version"`
  - `src-tauri/Cargo.toml` → `version`
  - `src-tauri/tauri.conf.json` → `version`
  - `src/locales/en.json` → `app.version`
  - `src/components/SettingsPanel/SettingsPanel.tsx` → About display

## Conventions

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **Append-only logging**: `docs/Project_Log.md` is append-only. Never delete or overwrite entries.
- **CSS variables for theming**: Use `var(--bg-card)`, `var(--text-primary)`, etc. from `src/styles/theme.css`. Never hardcode colors.
- **Tailwind for layout**: Use Tailwind utility classes for spacing, flex, grid. CSS variables for colors only.
- **Framer Motion for animation**: All animations use framer-motion. Don't introduce a second animation library.
- **Zustand for state**: UI state lives in `src/lib/store.ts`. App state lives in the Tauri backend.

## Architecture

- **Frontend ↔ Backend IPC**: All communication via typed `invoke`/`tauri::command`. See `src/lib/tauri-bridge.ts` and `src-tauri/src/commands.rs`.
- **File watching**: Uses `notify` crate with debounced event channel (300ms). Events sent via `app.emit()`.
- **Duplicate detection**: Blake3 hashing, Rayon parallelism. Groups by size first, then hashes.
- **Undo/Redo**: Every mutating operation writes a journal entry **before** execution. Journal is SQLite-backed.
- **Storage scan**: Uses mtime-based caching. Streaming progress events via `afo://storage_progress`.

## Gotchas

- **Tauri v2 `open()` with `directory: true`**: Requires `dialog:open` capability. If the picker doesn't appear, check `src-tauri/capabilities/default.json`.
- **CSP (Content Security Policy)**: `style-src` allows `'unsafe-inline'` for Tailwind. Scripts are restricted to self. Don't add `'unsafe-eval'`. `connect-src` must include `https://github.com` and `https://objects.githubusercontent.com` for the auto-updater to work.
- **CategoryConfig::categorize()**: Iterates all categories × extensions per call. Not a bottleneck at <100k files, but don't call it in tight loops unnecessarily.
- **`tokio::spawn` in Tauri setup**: Panics before the Tokio reactor is ready. Use `tauri::async_runtime::spawn` or defer to `ready()` event.
- **Linux .deb dependencies**: Tauri apps need `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev` for building, and `libsoup3-2.4`, `libappindicator3-1`, `gstreamer1.0`, `libepoxy0`, `libxkbcommon0`, `libwayland-client0` at runtime.

## UI Primitives

Custom primitives in `src/components/ui/`:
- `Card.tsx` — Card, CardHeader, CardDescription, CardRow
- `Button.tsx` — Primary, secondary, ghost variants
- `Toggle.tsx` — CSS-based switch (Galahhad pattern, readOnly input)
- `SegmentedControl.tsx` — Sliding indicator tab control
- `HoverButton.tsx` — Button with hover state
- `StorageBar.tsx` — Segmented bar for storage breakdown display

These are the design system. Don't replace them with framer-motion or third-party equivalents.

## Release Process

### Signing Keys

- **Location**: `.afo-keys/private.key` (encrypted minisign key), `.afo-keys/private.key.pub` (public key)
- **Password**: Stored in GNOME Keyring under label `AFO Release Signing Key`
- **Never commit** the private key password or expose it in logs

### Building & Signing Artifacts

```bash
# Source signing env vars from keyring
source .afo-keys/build-env.sh

# Build DEB + RPM (Linux)
cargo tauri build --bundles deb,rpm

# Build NSIS (Windows, cross-compile from Linux)
cargo tauri build --target x86_64-pc-windows-gnu --bundles nsis

# Sign artifacts (requires TAURI_SIGNING_PRIVATE_KEY_PASSWORD)
cargo tauri signer sign -f .afo-keys/private.key src-tauri/target/release/bundle/deb/AFO_X.Y.Z_amd64.deb
cargo tauri signer sign -f .afo-keys/private.key src-tauri/target/release/bundle/rpm/AFO-X.Y.Z-1.x86_64.rpm
cargo tauri signer sign -f .afo-keys/private.key src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/AFO_X.Y.Z_x64-setup.exe
```

### Publishing a Release

1. Create a draft release: `gh release create vX.Y.Z --draft --notes "..."`
2. Upload artifacts with signatures:
   ```bash
   gh release upload vX.Y.Z \
     src-tauri/target/release/bundle/deb/AFO_X.Y.Z_amd64.deb \
     src-tauri/target/release/bundle/deb/AFO_X.Y.Z_amd64.deb.sig \
     src-tauri/target/release/bundle/rpm/AFO-X.Y.Z-1.x86_64.rpm \
     src-tauri/target/release/bundle/rpm/AFO-X.Y.Z-1.x86_64.rpm.sig \
     src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/AFO_X.Y.Z_x64-setup.exe \
     src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/AFO_X.Y.Z_x64-setup.exe.sig \
     latest.json --clobber
   ```
3. Publish: `gh release edit vX.Y.Z --draft=false`

### Auto-Update Manifest (`latest.json`)

- Repo root `latest.json` must match the release artifacts
- Contains SHA256 hashes, file sizes, and download URLs
- Tauri updater fetches from `https://github.com/Himath-Rajapaksha/AFO/releases/latest/download/latest.json`
- Public key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
