# AFO Versioning Policy

Adopted: 2026-07-26 | Updated: 2026-07-26

## Core Rule

**A version number changes once per actual release — not once per response, not once per fix-and-reverify round-trip.**

Intermediate/test builds use pre-release suffixes (`-beta.N`) on the NEXT real version instead of bumping the real version number.

## Version Format

```
MAJOR.FEATURE.DEBUG[-prerelease.N]
```

```
Example: 3.1.1
         │ │ │
         │ │ └── DEBUG    — Debugging, minor fixes, patches
         │ └──── FEATURE  — New features, capabilities, UI additions
         └────── MAJOR    — Breaking changes, architecture rewrites
```

### MAJOR (first number)

Breaking changes that require user migration or are incompatible with prior versions:
- Config format changes
- Dropped OS support
- Complete UI redesigns that break muscle memory
- Database schema changes requiring migration
- API-breaking changes for plugins/extensions

### FEATURE (second number)

New functionality added in a backwards-compatible manner:
- New panels or views
- New capabilities (e.g., live capture, cloud sync)
- New file organization rules
- UI enhancements that don't break existing workflows
- Performance improvements that change user-visible behavior

### DEBUG (third number)

Backwards-compatible bug fixes and minor improvements:
- Bug fixes (crash fixes, incorrect behavior)
- UI polish (spacing, alignment, color corrections)
- Text/translation fixes
- Internal refactoring with no user-visible change
- Performance optimizations with no behavior change

## Pre-release Versions

When a build is going out for manual verification (design fixes, update-flow tests, etc.), use a pre-release suffix:

```
3.2.0-beta.1    ← first test build targeting 3.2.0
3.2.0-beta.2    ← second test build, still targeting 3.2.0
3.2.0-rc.1      ← release candidate (optional, for final validation)
3.2.0            ← the real release, only after user confirms it's good
```

**Never bump the real version number for a test build.** If you're iterating on fixes and verifications, increment the pre-release suffix, not the version itself.

## When to Bump What

| Change type | Bump | Example |
|---|---|---|
| New feature (backwards-compatible) | FEATURE | 3.1.0 → 3.2.0 |
| Bug fix (no new features) | DEBUG | 3.2.0 → 3.2.1 |
| Breaking change (config, OS, API) | MAJOR | 3.x → 4.0.0 |
| Test/verification build | pre-release suffix | 3.2.0 → 3.2.0-beta.1 |

## What Counts as a "Real Release"

A real release means:
- The build has been manually verified by the user
- All known regressions are fixed (or explicitly deferred with tracking)
- The version number is the un-suffixed form (no `-beta`, no `-rc`)
- CHANGELOG.md has been updated
- Git tag matches the version (`v3.2.0`)

## What Does NOT Warrant a Version Bump

- Fixing a typo in a comment
- Adjusting CSS spacing
- Adding a test
- Refactoring code without behavior changes
- Any change that's part of an in-progress verification round

These should all be committed normally but not version-bumped. The version number moves when the user says "this is good" about a build.

## Release Checklist

Before marking a version as released:

1. [ ] All features for this version are implemented and verified
2. [ ] No known regressions (or explicitly tracked with issue references)
3. [ ] `npx tsc --noEmit` passes
4. [ ] `cargo check` passes
5. [ ] Version strings updated in ALL locations:
   - `package.json` (`"version"`)
   - `src-tauri/Cargo.toml` (`version`)
   - `src-tauri/tauri.conf.json` (`version`)
   - `src/locales/en.json` (`app.version`)
   - `src/components/SettingsPanel/SettingsPanel.tsx` (About display)
6. [ ] CHANGELOG.md updated with this version's changes
7. [ ] Git tag created (`v<version>`)
8. [ ] Build artifacts produced (DEB, RPM, NSIS)
