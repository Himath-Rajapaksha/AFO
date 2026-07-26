# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development mode**: `npm run dev`  
  Starts the Vite dev server for the frontend and the Tauri Rust backend with hot reload.  
  The frontend connects to `http://localhost:1420` and Tauri loads the UI from there.

- **Production build**: `npm run build`  
  Compiles TypeScript, bundles the frontend with Vite, then bundles the Tauri application.  
  Output appears in `src-tauri/target/release/bundle` as platform-specific installers.

- **Preview production build**: `npm run preview`  
  Serves the built frontend locally for preview.

- **Tauri dev with explicit Rust reload**: `cargo tauri dev`  
  Starts the Tauri backend and watches Rust source changes; frontend still uses Vite dev server.

- **Type checking**: `npx tsc --noEmit`  
  Runs TypeScript type checker without emitting files.

- **Linting**: `npm run lint`  
  Runs ESLint on `src/**/*.{ts,tsx}`.

- **Auto-fix linting**: `npm run lint:fix`  
  Runs ESLint with `--fix`.

- **Formatting**: `npm run format`  
  Formats TypeScript, TSX, and CSS files with Prettier.

- **Check formatting**: `npm run format:check`  
  Checks formatting with Prettier.

## Project Structure

### Frontend (React + TypeScript)
- **Location**: `/src`
- **Entry point**: `src/main.tsx` – registers Tauri event listeners and renders `<App />`.
- **Root component**: `src/App.tsx` – manages UI layout, panels, drap-and-drop, and global listeners for Tauri events.
- **State management**: Zustand store in `src/lib/store.ts` (active panel, dragged paths).
- **Tauri bridge**: Typed invoke wrappers in `src/lib/tauri-bridge.ts` – each backend command exported as a TypeScript async function.
- **Components** (`src/components/`):
  - **Panels**: `OrganizePanel`, `LiveCapture`, `RuleBuilder`, `DuplicatesPanel`, `StoragePanel`, `HistoryPanel`, `SettingsPanel`. Each maps to a sidebar item.
  - **UI primitives** (`src/components/ui/`): Button, Card, Toggle, SegmentedControl, HoverButton,illary – built with Tailwind CSS and lucide-react icons.
  - **Other**: `DropZone` (drag‑and‑drop file input), `Toast` (notifications), `CommandPalette` (Cmd+K search).
- **Styling**:
  - Tailwind CSS configured via `tailwind.config.js` and `postcss.config.js`.
  - Design tokens via CSS custom properties in `src/styles/theme.css` (light/dark themes).
  - Theme context via `src/lib/ThemeProvider.tsx`.
- **Types**:
  - Global Typescript interfaces in `src/lib/tauri-bridge.ts` (shared with backend via invoke).
  - Tauri plugin typings in `src/types/tauri-plugins.d.ts`.
  - Asset types in `src/assets.d.ts`.

### Backend (Rust + Tauri)
- **Location**: `/src-tauri/src`
- **Entry point**: `src-tauri/src/main.rs` – calls `afo_lib::run()`.
- **Library API**: `src-tauri/src/lib.rs` – sets up tracing, Tauri plugin registration, initializer tasks (journal, capture, scheduler, watcher), and registers all command handlers via `tauri::generate_handler![]`.
- **Command implementations**: `src-tauri/src/commands.rs` – thin async wrappers that call core functions and return results (or error strings). Each command is tagged with `[tauri::command]`.
- **Core modules** (`src-tauri/src/core/`):
  - `organizer.rs` – file scanning, moving, renaming.
  - `rule_engine.rs` – parsing and executing user‑defined rules (conditions + actions).
  - `duplicates.rs` – Blake3 hashing, Rayon parallel duplicate detection, quarantine logic.
  - `metadata.rs` – EXIF (via kamadak-exif, lofty) and audio tag extraction.
  - `journal.rs` – SQLite‑backed undo/redo journal (via rusqlite).
  - `watcher.rs` – filesystem watching (notify crate) with debounced event channel.
  - `scheduler.rs` – cron‑based automation (tokio-cron-scheduler).
  - `capture.rs` – real‑time folder watching for live capture mode.
  - `cloud_sync.rs` – stub for cloud synchronization.
  - `mod.rs` – module declarations.
- **Capabilities**: `src-tauri/capabilities/default.json` – defines allowed Tauri capabilities (fs, shell, etc.).
- **Build configuration**: `src-tauri/tauri.conf.json` – see below.

### Tauri Configuration (`tauri.conf.json`)
- **Build**:
  - `beforeDevCommand`: `npm run dev` (starts Vite).
  - `devUrl`: `http://localhost:1420`.
  - `beforeBuildCommand`: `npm run build` (builds frontend before Tauri bundles).
  - `frontendDist`: `../dist` (relative to Tauri target directory).
- **Application**:
  - Window size: 1200×800, resizable, decorated.
  - Content Security Policy (CSP) restricts scripts/styles to self, allows inline styles (Tailwind), Google Fonts, Tauri IPC, and GitHub for auto-updates.
- **Bundling**:
  - Icons, NSIS/WiX/DMG settings for installers.

## Development Workflow

1. **Start development**:  
   ```bash
   npm run dev
   ```
   - Vite serves React app with HMR.
   - Tauri launches the native window, loading the Vite dev server.

2. **Make changes**:
   - **Frontend**: Edit files under `src/` – changes trigger Vite HMR, UI updates instantly.
   - **Backend**: Edit files under `src-tauri/src/` – the `cargo tauri dev` command (or the dev server started by `npm run dev`) will automatically rebuild the Rust binary and reload the window.
   - **Styles**: Edit `src/styles/theme.css` or Tailwind config; changes appear after HMR.
   - **Types**: Keep `tauri-bridge.ts` in sync with the actual command signatures in `commands.rs`.

3. **Build for release**:  
   ```bash
   npm run build
   ```
   Produces a production‑ready frontend in `dist/` and bundles it with the Rust binary.

4. **Preview**:  
   ```bash
   npm run preview
   ```
   Serves the built `dist/` directory.

5. **Type‑check**:  
   ```bash
   npx tsc --noEmit
   ```

6. **Lint & format**:  
   ```bash
   npm run lint        # check
   npm run lint:fix    # fix
   npm run format      # format
   ```

## Extending the Application

### Adding a New Tauri Command
1. Implement the core function in the appropriate `src-tauri/src/core/*.rs` file.
2. Export an async handler in `src-tauri/src/commands.rs`:
   ```rust
   #[tauri::command]
   pub async fn my_new_command(arg: String) -> Result<ReturnType, String> {
       core::some_module::my_function(arg).map_err(|e| e.to_string())
   }
   ```
3. Add the command to the invoke handler list in `src-tauri/src/lib.rs` inside `tauri::generate_handler![...]`.
4. (Optional) Add a TypeScript binding in `src/lib/tauri-bridge.ts`:
   ```ts
   export async function myNewCommand(arg: string): Promise<ReturnType> {
     return invoke<ReturnType>("my_new_command", { arg });
   }
   ```

### Adding a New Frontend Panel
1. Create the component under `src/components/<PanelName>/<PanelName>.tsx` (and an `index.ts` re‑export).
2. Import the component in `src/App.tsx` and add it to the `panels` object:
   ```ts
   import MyPanel from "./components/MyPanel";
   // ...
   const panels = {
     // ...existing
     my: MyPanel,
   } as const;
   ```
3. Add the sidebar entry in `src/components/Sidebar/Sidebar.tsx` (or wherever the sidebar enum is defined) and ensure the route matches a panel key.
4. Update the `Panel` type in `src/lib/store.ts` if needed.

### Adding a New UI Primitive
1. Create the component in `src/components/ui/` (e.g., `MyControl.tsx` + optional CSS).
2. Export from `src/components/ui/index.ts` if you want a barrel export.
3. Use Tailwind CSS for styling; follow the existing design‑token approach (use `var(--bg‑card)`, etc.).
4. Export the component’s TypeScript props.

### Updating the Design System / Theme
- CSS custom properties live in `src/styles/theme.css`.  
  Add new variables under `:root` (light) and `.dark` (dark) classes.
- The `ThemeProvider` toggles the `dark` class on `<html>` based on `localStorage` or system preference.
- Use `className` utilities from Tailwind; avoid hard‑coding colors.

## Key Technical Details

- **State Management**: Zustand store (`src/lib/store.ts`) holds minimal UI state (active panel, dragged files). Most app state lives in the Tauri backend (SQLite journal, in‑memory caches).
- **Inter‑Process Communication**: All frontend‑backend communication is typed via `invoke`/`tauri::command`. See `tauri-bridge.ts` and `commands.rs`.
- **File Watching**: Uses the `notify` crate; events are sent over an unbounded MPSC channel to a Tokio task that processes each path via `watcher::process_file_event`.
- **Duplicate Detection**: Files are grouped by size first, then Blake3 hashes computed in parallel via Rayon. Duplicate groups are managed via SQLite journal for safe quarantine/deletion.
- **Metadata Extraction**:
  - Images: `kamadak-exif` (EXIF) + fallback to `lofty`.
  - Audio: `lofty` (supports MP3, FLAC, etc.).
- **Undo/Redo**: Every mutating operation (move, copy, rename, delete) writes a journal entry before execution. Undo/redo re‑applies the inverse operation.
- **Scheduler**: Uses `tokio-cron-scheduler`; each schedule stores a cron expression and an action payload. The scheduler runs a background task that triggers the appropriate command via `app_handle.emit_all`.
- **Security**: CSP restricts inline scripts; only `style-src` allows `'unsafe-inline'` for Tailwind. All IPC is validated by Tauri’s command system.
- **Logging**: Structured tracing with `tracing` crate; logs written to `${DATA_DIR}/afo/afo.log` with daily rotation.

## Frequently Used Files

| Purpose                                 | Path                                                       |
|-----------------------------------------|------------------------------------------------------------|
| App entry (frontend)                    | `src/main.tsx`                                             |
| Root UI component                       | `src/App.tsx`                                              |
| Zustand store                           | `src/lib/store.ts`                                         |
| Tauri‑bridge (typed invocations)        | `src/lib/tauri-bridge.ts`                                  |
| Backend entry                           | `src-tauri/src/main.rs`                                    |
| Library / Tauri setup                   | `src-tauri/src/lib.rs`                                     |
| Command implementations                 | `src-tauri/src/commands.rs`                                |
| Core modules (organizer, rules, etc.)   | `src-tauri/src/core/*.rs`                                  |
| Tauri config                            | `src-tauri/tauri.conf.json`                                |
| Tailwind config                         | `tailwind.config.js`                                       |
| PostCSS config                          | `postcss.config.js`                                        |
| TypeScript config                       | `tsconfig.json`                                            |
| Vite config                             | `vite.config.ts`                                           |

## Versioning

Follow `VERSIONING.md` — uses **MAJOR.FEATURE.DEBUG** format:
- **MAJOR** — Breaking changes (config format, OS support, API)
- **FEATURE** — New features (new panels, capabilities, UI additions)
- **DEBUG** — Bug fixes and minor improvements

Version number changes **once per actual release**, not per iteration. Test builds use pre-release suffixes: `3.2.0-beta.1`, `3.2.0-beta.2`, etc. Version strings must be consistent across: `package.json`, `Cargo.toml`, `tauri.conf.json`, `en.json`, `SettingsPanel.tsx`.

## Troubleshooting

- **Tauri dev fails to start**: Ensure Node.js ≥20 and Rust stable toolchain are installed. Run `rustup update` and `npm install`.
- **Frontend hot reload not working**: Check that `npm run dev` is running and that the Tauri `beforeDevCommand` is not overridden.
- **Command not found on frontend**: Verify that the command is listed in `tauri::generate_handler![...]` in `src-tauri/src/lib.rs` and that the corresponding function exists in `src-tauri/src/commands.rs`.
- **Missing icons**: Ensure `lucide-react` is installed (`npm i lucide-react`) and that imports are correct (`import { LucideIcon } from 'lucide-react';`).
- **Style not updating**: Tailwind CSS uses JIT; restart dev server if new utility classes are not detected (`npm run dev`).

## Making a Production Build

1. Run `npm run build` – this will:
   - Run `tsc` for type checking.
   - Bundle the React app with Vite into `dist/`.
   - Run `cargo tauri build` (via `beforeBuildCommand`) to produce binaries.
2. Find the installers in `src-tauri/target/release/bundle/`.
   - Linux: `.deb` and `.AppImage`
   - macOS: `.dmg`
   - Windows: `.exe` (NSIS) and `.msi` (WiX)
3. Cross-compile Windows from Linux:
   ```bash
   cargo tauri build --target x86_64-pc-windows-gnu --bundles nsis
   ```
   Output: `src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`

## Release Process

See `project_rules.md` for full release process including signing, artifact upload, and `latest.json` updates.

## Debugging

- **Frontend**: Open DevTools from the Tauri menu (View → Toggle Developer Tools) or press `F12`.
- **Backend**: Check the terminal where `npm run dev` was started for Rust `tracing` logs (info, error, etc.).
- **Log file**: `%USERPROFILE%/afo/afo.log` (Windows), `$HOME/.local/share/afo/afo.log` (Linux), `~/Library/Logs/afo/afo.log` (macOS).

## Testing

Currently the project does not have a configured test suite. To add unit tests:
- For Rust: use the built‑in `#[cfg(test)]` modules in each core file; run `cargo test`.
- For TypeScript/Vitest: add `vitest` or `jest` config and place tests alongside source files (`*.test.ts`).

---

*This guide is intended to help Claude Code quickly understand the AFO codebase and contribute effectively.*