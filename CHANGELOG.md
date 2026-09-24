# Changelog

## 0.1.3 — 2026-09-24

Not web-only.

- **Platforms** — `platform:` on a screen (`web`, `ios`, `android`, `tablet`, `kiosk`), a project default in `conventions.platforms`, built-in sizes a team can override. `render` draws each screen at its platform's width inside its frame: phone (status bar, home indicator), tablet, portrait kiosk, or none for web.
- **Twelve mobile kinds** in the bundled set: `app-bar`, `tab-bar`, `list-cell`, `bottom-sheet`, `fab`, `snackbar`, `chip`, `search-bar`, `segment`, `stepper`, `pull-to-refresh`, `sheet-handle`.
- **Flows carry `gesture` and `nav`**; `conventions.flows` names the vocabulary and L16 warns outside it. L17 warns on a platform the project does not list.
- `examples/mobile-app`: a feed, a detail pushed from a cell, a cart sheet — iOS.

## 0.1.2 — 2026-09-24

Generality, ahead of the first outside user.

- **MUI adapter** — `--base mui` draws mapped kinds with MUI components through emotion, themed from tokens. `bases` now says `antd` and `mui` are ready; `shadcn` is listed as not applicable with the reason (it is copied source, so `--base none` is its road).
- **Language** — `meta.language` in `conventions.yaml` (`en`, `ko`) switches the viewer's own words and the sample values. Screen content is never translated.
- **Frame name presets** for `import figma` — `naming.frame_pattern` takes a regex or `screen-state`, `screen/state`, `screen state`, `screen=state`.
- A self-built project's `components/` is self-contained again (its `kinds.js` brings `i18n.js` along).

## 0.1.1 — 2026-09-24

For anyone, not just the author's machine.

- Install without a clone: `npx -y github:byjunyoung/design-core …` for the CLI and as the MCP `command` for Claude Code, Cursor and Codex (config snippets in the README).
- `init` writes a starter screen and a project README, and prints what to do next, so `serve` is never empty.
- The default `screen_pattern` accepts letters in any script; a team whose screens are named in Korean or Japanese no longer trips L01 on its first lint.
- No company file keys in the docs; `<file-key>` explains itself.

## 0.1.0 — 2026-09-24

First usable version. Everything below runs locally from a clone; nothing is hosted yet.

- **Screen files** — one YAML per screen: elements, `layout` by token names, `states` as patches, `variants` by axis, `flows`, `refs`, `$tbd` for undecided values. JSON Schema for screens and for `conventions.yaml`.
- **`lint`** — schema check plus rules L01–L15: required states per screen type, dead flows, patches that target nothing, `$tbd` counts (blocking when overdue or on the canonical branch), layout outside the token vocabulary, variant shape. Every finding carries file, YAML path and line.
- **`prep`** — stubs the states a screen type requires as placeholders carrying `$tbd`, keeping the file's comments.
- **`diff`** — AS-IS / TO-BE between two versions of a screen (files or git refs); elements compared by id.
- **`render`** — static HTML: sidebar of screens, state tabs with a compare toggle, a drawer inspector (kind, mapped component, props, file · path · line), meta information as dots, sample values in empty cells. Bundled component set, or a library through an adapter (`antd` today), themed from `tokens.json`.
- **`init` / `bases`** — start a project with a library base or a self-built one (the bundled set copied into the project, yours to edit).
- **`propose` / `apply` / `reject` / `undo`** — the edit loop: a whole new version of a screen, with diff, lint before/after, a tier, and the decisions agreed before it; text-only changes that keep lint clean apply at once, structure waits for a person.
- **`serve`** — the live viewer: pages rendered from the files on every request, comments anchored to elements, Apply / Reject on a proposal page, `/api/*` for bots.
- **`mcp`** — the same verbs over MCP on stdio, plus `list_screens`, `get_screen`, `list_missing`, comments, and a `draw` prompt that walks an agent through deciding before proposing.
- **`map figma` / `import figma`** — bring a Figma page in: masters paired with kinds by name, frames named `{screen}-{state}` as screens with the other states as patches, auto-layout as layout, prototype links as flows, unresolved values as `$tbd`.
- Field-tested on six real admin screens (transcribed under generic names in `examples/store-ops`) and on two real Figma pages; what each taught the format is in `DESIGN.md` §12.
