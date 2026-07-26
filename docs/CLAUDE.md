# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AFO - Advanced File Organizer

Cross-platform desktop file organizer built with Tauri (Rust backend + React frontend).

Key features include organizing files by extension or date, batch renaming, rule-based organization, duplicate detection, metadata extraction, undo/redo, real-time folder watching, scheduled automation, and a command palette.

Tech stack: Rust/Tauri backend, React 18 + TypeScript frontend, Tailwind CSS, Framer Motion, Zustand, ReactFlow, blake3, rayon, notify, rusqlite.

## Development Commands

- **Development mode**: `npm run dev`  
  Starts the Tauri development server with frontend Vite dev server and Rust backend.

- **Production build**: `npm run build`  
  Builds the frontend and bundles the Tauri application for production.

- **Preview production build**: `npm run preview`  
  Previews the production build locally.

- **Type checking**: `npm run build` includes TypeScript checking via `tsc`; standalone check: `npx tsc --noEmit`

- **Linting**: Not configured by default; consider adding ESLint

- **Formatting**: Not configured by default; consider adding Prettier

## Project Structure

### Frontend (React + TypeScript)
- Located in `/src`
- Main entry: `src/main.tsx`
- Root component: `src/App.tsx`
- Components organized by feature in `/src/components`:
  - `Sidebar`: Main navigation
  - `OrganizePanel`: Core file organization controls
  - `RuleBuilder`: UI for creating organization rules
  - `DuplicatesPanel`: Duplicate file detection and management
  - `HistoryPanel`: Operation history and undo/redo
  - `SettingsPanel`: Application settings
  - `CommandPalette`: Command search interface
- Styling: Tailwind CSS configured via `tailwind.config.js` and `postcss.config.js`
- Tauri bridge: `src/lib/tauri-bridge.ts` for communicating with Rust backend

### Backend (Rust + Tauri)
- Located in `/src-tauri/src`
- Main entry: `src-tauri/src/main.rs`
- Library API: `src-tauri/src/lib.rs` and `src-tauri/src/commands.rs`
- Core functionality modules in `src-tauri/src/core/`:
  - `organizer.rs`: Core file organization logic
  - `rule_engine.rs`: Rule parsing and execution
  - `duplicates.rs`: Duplicate file detection
  - `watcher.rs`: File system watching for auto-organization
  - `journal.dart`: Operation history and undo/redo
  - `scheduler.rs`: Scheduled tasks
  - `metadata.rs`: File metadata extraction
  - `cloud_sync.rs`: Cloud synchronization (placeholder)
  - `mod.rs`: Module declarations

### Tauri Configuration
- Configuration file: `src-tauri/tauri.conf.json`
- Build configuration:
  - `beforeDevCommand`: `npm run dev` (starts Vite dev server)
  - `devUrl`: `http://localhost:1420` (Vite dev server URL)
  - `beforeBuildCommand`: `npm run build` (builds frontend before Tauri build)
  - `frontendDist`: `../dist` (relative to Tauri build directory)

## Development Workflow

1. Start development: `npm run dev`
   - This starts both the Vite dev server (React) and the Tauri Rust backend
   - The frontend connects to the dev server at `http://localhost:1420`
   - Tauri loads the frontend from the dev URL

2. Make changes:
   - Frontend: Edit files in `/src` - changes trigger Vite HMR
   - Backend: Edit files in `/src-tauri/src` - changes require rebuild (use `cargo tauri dev` for hot reload if configured)

3. Building for production:
   - Run `npm run build` to create a production build
   - This will:
     a. Build the frontend with Vite (output to `/dist`)
     b. Bundle the frontend with the Tauri Rust binary
     c. Produce platform-specific installers in `src-tauri/target/release/bundle`

4. Preview production build:
   - Run `npm run preview` to locally preview the built application

5. Type checking:
   - Run `npx tsc --noEmit` to check TypeScript types without emitting

6. Linting:
   - No lint script configured by default; consider adding ESLint for code quality

7. Formatting:
   - No format script configured; consider adding Prettier for consistent code formatting

## Key Conventions

- **Tauri Commands**: Backend functions exposed to frontend are defined in `src-tauri/src/commands.rs` and invoked via the Tauri bridge.
- **State Management**: Application state is managed through React hooks and context where appropriate, with persistence handled by the Rust backend.
- **Styling**: Tailwind CSS utility-first approach. Custom styles in `src/index.css`.
- **TypeScript**: Strict type checking enabled via `tsconfig.json`.

## Versioning

Follow `VERSIONING.md` — uses **MAJOR.FEATURE.DEBUG** format:
- **MAJOR** — Breaking changes (config format, OS support, API)
- **FEATURE** — New features (new panels, capabilities, UI additions)
- **DEBUG** — Bug fixes and minor improvements

Version number changes **once per actual release**, not per iteration. Test builds use pre-release suffixes: `3.2.0-beta.1`, `3.2.0-beta.2`, etc. Version strings must be consistent across: `package.json`, `Cargo.toml`, `tauri.conf.json`, `en.json`, `SettingsPanel.tsx`.

## Debugging

- Frontend debugging: Use browser dev tools (accessible via Tauri devtools)
- Backend debugging: Check terminal output from `npm run dev` or use Rust debugging tools
- Tauri debugging: Enable devtools in `tauri.conf.json` (already configured in development)