# Changelog

All notable changes to AFO will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [VERSIONING.md](VERSIONING.md).

---

## [Unreleased]

### Added
- Storage scan performance optimization: mtime-based caching, streaming progress events, file counts per category

### Fixed
- Live Capture file-change toast notifications (consolidated event listener)
- Sidebar collapse-to-icons toggle with localStorage persistence
- Storage per-drive system view (replaced old single-directory category-bar)

---

## [3.3.1-beta] — 2026-07-25

Pre-release build. Design system regression fixes. Not a real release.

### Fixed
- i18n namespace resolution (each en.json top-level key registered as its own namespace)
- Toggle double-toggle bug (input onChange + button onClick both firing)
- Button focus-visible styles for keyboard accessibility
- SegmentedControl restored to CSS-based sliding indicator

### Known Issues
- Logo color: needs black bg + white funnel (not blue, not transparent)
- CardHeader uppercase styling lost in design system integration

---

## [3.1.1] — 2026-07-25

### Fixed
- Export uses native Save As dialog instead of directory picker
- Removed invalid `installMode` from updater config
- Registered fs plugin with `dialog:save` + `fs` permissions

---

## [3.1.0] — 2026-07-25

### Added
- **Rule Import/Export**: Export rules as JSON, import with conflict handling (same-name rules replaced)
- **History Search & Filtering**: Full-text search across source/dest paths, filter by operation type and date range
- **Auto-Updates**: tauri-plugin-updater with GitHub release integration, local signing workflow
- **Accessibility audit**: 6 critical (C1-C6), 5 high (H1-H5), 8 medium (M1-M8) fixes — focus traps, aria-pressed, keyboard navigation
- **Localization**: react-i18next with en.json locale file, all UI strings extracted

---

## [3.0.3] — 2026-07-24

### Fixed
- Removed devtools from production builds

---

## [3.0.2] — 2026-07-24

### Fixed
- Light theme font colors in RuleFlowEditor visual editor

---

## [3.0.1] — 2026-07-24

### Fixed
- Replaced icon with new AFO icon
- Linux icon sizes for GNOME desktop entry

---

## [3.0.0] — 2026-07-23

Major release with new visual identity and finalized features from v2.5.50-beta.

### Added
- New blue app icon (AFO-icon.png)
- Tutorial as dedicated panel
- macOS-style storage redesign with drive detection
- Live capture directory removal
- Accent color #0071E3

### Changed
- Version bumped to 3.0.0 across all manifests

---

## [2.5.50-beta] — 2026-07-23

Pre-release build for v3.0.0 features.

### Added
- Tutorial panel
- Storage redesign (per-drive system view)
- Live capture directory removal
- Accent color system

---

## [2.5.49] — 2026-07-23

### Fixed
- Notification toast in live capture mode

---

## [2.5.48] — 2026-07-23

### Fixed
- Double-toast bug in auto-organize mode

---

## [2.5.47] — 2026-07-23

### Added
- Sidebar collapse-to-icons toggle

### Fixed
- Live Capture toast notifications for file changes

---

## [2.5.45] — 2026-07-23

### Fixed
- Critical security + journal integrity fixes

---

## [2.5.44] — 2026-07-23

### Changed
- Performance efficiency audit

---

## [2.5.43] — 2026-07-23

### Fixed
- Storage Breakdown NaN bug (consolidated to StorageBar, added 'X scanned' display)

---

## [2.5.42] — 2026-07-23

### Fixed
- Native design system dark mode cleanup

---

## [2.5.41] — 2026-07-23

### Changed
- Faster detection, debug logging
### Fixed
- Sidebar version display

---

## [2.5.40] — 2026-07-23

### Added
- Real-time capture detection wired up

---

## [2.5.39] — 2026-07-23

### Added
- Permission-denied directory handling

---

## [2.5.38] — 2026-07-23

### Fixed
- Live Capture bugfixes

---

## [2.5.37] — 2026-07-22

### Added
- Live Capture system (real-time folder watching)

---

## [2.5.36] — 2026-07-22

### Added
- Preset rule templates

---

## [2.5.35] — 2026-07-22

### Added
- Live activity feed for file watcher events

---

## [2.5.33] — 2026-07-22

### Fixed
- Rule Builder cleanup (removed duplicate Create Rule button)

---

## [2.5.31] — 2026-07-22

### Fixed
- History loading fix
- Dead feature remediation (wired all stubs or disabled explicitly)

---

## [2.5.3] — 2026-07-22

### Fixed
- Dead feature remediation

---

## [2.5.1] — 2026-07-21

### Fixed
- Panel state loss on tab switch

---

## [2.5.0] — 2026-07-21

### Added
- Native macOS-inspired design system (light/dark theme)
- Card, Toggle, SegmentedControl, Button UI primitives

---

## [2.0.0] — 2025-07-20

Initial Tauri v2 release. Complete rewrite from Python/tkinter.

### Added
- Rule-based file organization (by extension, by date, batch rename)
- Duplicate detection (blake3 + rayon parallelism)
- Undo/redo journal (SQLite)
- Metadata extraction (EXIF, audio tags)
- Real-time folder watching (opt-in per directory)
- Scheduled automation (cron)
- Command Palette (Cmd+K)
- Drag-and-drop file input
- Live progress events
