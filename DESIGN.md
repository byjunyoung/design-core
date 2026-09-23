# Design core — a management layer for screens that agents draw

Status: design draft v0.1 · 2026-09-23 · license MIT, home github.com/byjunyoung/design-core; the name is provisional (see the last section).

Every decision below carries a one-line *why*. Where a value is one team's habit rather than a general rule, it appears only as an example, and the shipped default is `null` or empty.

## 1. What this is, and what it is not

Agents now draw screens well. Figma has a design agent; pen.dev, Paper, Subframe and Claude Design draw from a prompt; OpenPencil, Open Design, AI Design Canvas and Penpot do it in the open. All of them are **canvases**: a geometric document (frames, nodes, auto-layout, tokens) plus tools to change it (research: `~/Documents/XYZ/research/topics/2026-09-23-에이전트-네이티브-디자인-툴.md`).

None of them answers the questions a team asks over months of shipping:

- Which states of this screen exist, and which are missing?
- Does every flow arrow land on a screen that exists?
- Which screens are canonical, which are still being worked on, and what shipped but never made it back?
- What changed between the version engineering was handed and this one?
- Which spec entry and which ticket does this screen answer to?

This project is that layer. **It owns the semantic model of a product's screens and the checks that keep it honest. It does not own pixels.** Canvases plug in underneath as importers and exporters.

```
                     spec (PRD)         tracker (ticket)
                          \                 /
                           v               v
   agent / CI  ──>  [ core: model · lint · prep · diff · render ]  <──  human (HTML preview)
                           ^               |
                   import  |               |  export
                           |               v
        Figma · .pen · .op · Penpot · code (React/antd) · plain HTML
```

The rule set comes from the `fig` plugin, which three designers have run on one company's Figma files across several products since mid-2026. What migrates is the *rules* — naming, required states per screen type, `A --> B` flows, `[state]` chains, blocking/warning grading, canonical/working/queue/archive lifecycle. What stays behind is the code: `fig`'s audit scripts walk Figma node trees inside `use_figma` and cannot run anywhere else.

## 2. Scope of v0

**In**

- The model (§3) and its YAML representation (§4)
- `lint` — the audit, read-only, graded blocking/warning
- `prep` — stubs the states a screen type requires but the file lacks
- `diff` — two versions of a screen → an AS-IS/TO-BE table
- `render` — one HTML page per screen, every state side by side, drawn with **real components** (§6.1) so a designer can review it, not boxes
- A CLI and an MCP server exposing the same verbs with the same output
- Figma import (via the existing Figma MCP) so a team already on Figma can start without redrawing

**Out** — deliberately, so the thing stays light

- A canvas: dragging, free placement, handles, pixel adjustment. Drawing *from the file* is in (`render`); drawing *by hand* is out — the moment a canvas exists this is one more canvas, and the day-one lightness is gone
- Realtime collaboration, hosting, accounts
- Generating production code (export to code is a later adapter, not v0)
- Visual token binding checks (a canvas concern; `fig:tokens` stays where it is)

## 3. The model

Seven objects. Everything else is a representation of these.

```
Project
 └─ Section            "03. Orders - Order list"  (a feature; groups screens)
     └─ Screen         order-list  · type: list   (status is derived from git, §7 — not stored)
         ├─ Element    id · kind · props · children      (the Default state, as a tree)
         ├─ State      Empty · Loading · Error … each a patch on the Default tree
         ├─ Flow       from element[.anchor] → to screen[.state] · when · style
         ├─ Ref        prd: · task: · figma: · file:      (typed URIs)
         └─ Decision   every value is set | $tbd{owner, due}
```

Decisions behind the model:

| Decision | Chosen | Why |
|---|---|---|
| Depth of an element | Shallow: `kind` + a few props, no geometry | Agents write and diff it reliably; geometry belongs to the canvas that renders it. Pixel-level review happens after export. |
| How a state is stored | As a patch on Default (`replace` / `hide` / `set`) | The question a reviewer asks is "what changes in this state", and a patch *is* that answer. A merged view is computed, never stored. |
| Vocabulary of `kind` | Own small list, each with `maps_to` per design system | A screen file must not break when the team moves from Bootstrap to antd (this happened in 2026-09). The list ships small; teams extend it in conventions. |
| Identity | References (`flows.to`, `row_action`, `section`) use the human-readable `screen` name. A stable `id` exists only so `diff` can pair a file across versions after a rename. A `rename` verb rewrites references project-wide; L05 catches what it misses. | Agents and reviewers read `to: order-detail` without a lookup. What survives a rename: the diff pairing. What does not, without `rename`: references — and the lint says exactly which. Figma's node ids taught the other half: a re-created frame is a new id and every arrow to it breaks, so the id is never derived from the name. |
| Undecided values | `{ $tbd: { owner, due } }` — a plain mapping under a reserved key, not an empty string and not a YAML tag | An empty string reads as "nothing here", a `$tbd` reads as "someone owes this". A plain mapping survives `safe_load`, JSON Schema, yamllint and every agent's YAML writer; a custom tag fails all four. `lint` counts them; handoff refuses overdue ones. |
| References | Typed URI strings (`notion:…`, `github:owner/repo#12`, `figma:file/node`, `file:…`) | A fixed `prd`/`task` pair assumes Notion and GitHub. A URI scheme lets a team point at Jira, Linear, a markdown file, or nothing. |
| Screen type → required states | A table in conventions, ships with three example rows | The `fig` rule that caught the most missing work. The rows are one team's — `list: [Default, Empty, Loading, Error]` — so they ship as examples, and a team with no rows simply gets no check. |

Why not adopt `.pen`, `.op` or AI Design Canvas's document instead? All three are geometry-first (frames, shapes, auto-layout, variables) — checked 2026-09-23 on their public pages; none documents states-per-screen, flows between screens, or a canonical/working lifecycle as first-class objects. AI Design Canvas comes closest (presentation states, a DESIGN.md with prose + tokens) but still stores a canvas. Adopting one would make this project a plugin of that canvas. Diverging keeps it one importer/exporter among several. Divergence is deliberate, and the cost is an adapter per format.

## 4. The file format

One screen, one file. YAML because humans read and review it in pull requests; JSON Schema validates it. Directory layout:

```
design/
├── conventions.yaml          rules: naming, screen types, kinds, refs, lifecycle
├── tokens.json               optional; used by render, never required by lint
├── sections.yaml             "03. Orders - Order list" and their order
└── screens/
    ├── order-list.yaml
    └── order-detail.yaml
```

### 4.1 A screen file

```yaml
schema: design-core/0.1
id: scr_01J8K3            # stable; never reused; only `diff` reads it
screen: order-list        # the name every reference uses
section: "03. Orders - Order list"   # a row in sections.yaml, by name
type: list                # decides required states
refs:
  - prd: notion:2a1f0d…
  - task: github:acme/task-management#4155
  - design: figma:AbC123/45-678
layout: table-page        # a pattern name from conventions; null if the team has none

elements:                 # the Default state
  - id: filter
    kind: filter-form
    fields: [period, branch, status]
  - id: table
    kind: table
    columns: [order_no, branch, amount, status, ordered_at]
    row_action: order-detail
  - id: paging
    kind: pagination

states:                   # each a patch on `elements`
  Empty:
    - { target: table, replace: { kind: empty-notice, text: "No orders match." } }
  Loading:
    - { target: table, replace: { kind: skeleton, rows: 10 } }
  Error:
    - { target: table, replace: { kind: error-notice, text: { $tbd: { owner: pm, due: 2026-10-02 } } } }

flows:
  - from: table
    via: row              # an anchor the kind declares in conventions
    to: order-detail
  - from: filter
    to: order-list.Empty
    when: "0 results"
    style: conditional     # rendered dashed; same meaning as fig's `[state]` chain

notes:
  - The branch column is hidden for single-branch accounts.   # decisions travel with the screen
```

`$tbd` is an ordinary mapping under a reserved key, so a missing value is visibly different from an empty one, every parser reads it, and JSON Schema can validate its shape.

### 4.2 conventions.yaml

The semantic half of `fig`'s `figma-conventions.yaml`. The rendering half (pixel gaps, section fill, arrow stroke) does not come along; it belongs to the Figma export adapter's own config.

```yaml
naming:
  screen_pattern: '^[a-z0-9-]+$'
  section_pattern: '^\d{2}\. .+ - .+$'         # example; null disables the check
states:
  known: [Default, Empty, Loading, Error, Validation, Selected]
  required:                                     # example rows; a team writes its own
    list:   [Default, Empty, Loading, Error]
    form:   [Default, Validation]
    search: [Default, Empty]
kinds:
  table:      { anchors: [row, header], maps_to: { antd: Table, mui: DataGrid } }
  filter-form: { maps_to: { antd: Form } }
  # a kind with no maps_to still lints and renders; export falls back to a plain block
refs:
  required: [prd]                               # empty list = no check
  schemes: [notion, github, figma, file, https]
lifecycle:
  canonical_branch: main                        # status is derived from here, never stored
  handoff_requires: [lint:blocking=0, refs:prd]
```

## 5. Lint catalogue

Every rule has an id, a severity, and the `fig` rule it descends from. Blocking rules stop `handoff`; warnings are reported and counted.

| id | severity | checks | from fig |
|---|---|---|---|
| L01 name-pattern | blocking | screen and section names match the patterns | `audit-struct` naming |
| L02 section-exists | blocking | `section` points at a row in sections.yaml | frame membership |
| L03 required-states | blocking | every state `required[type]` lists is present | placeholder / coverage |
| L04 unknown-state | warning | a state not in `states.known` | naming |
| L05 flow-target | blocking | `flows.to` resolves to a screen or screen.state | arrow coverage / orphan |
| L06 flow-source | warning | `flows.from` resolves to an element, and `via` (if given) is an anchor its kind declares | arrow entry |
| L07 patch-target | blocking | a state patch targets an element that exists | — (new; the canvas never had this) |
| L08 tbd-count | warning | reports every `tbd`, grouped by owner; **blocking when past due** | placeholder text |
| L09 refs-required | warning | the refs `refs.required` names are present | task_tracker link |
| L10 kind-known | warning | every `kind` appears in conventions | component default residue (loosely) |
| L11 canonical-clean | blocking | on the canonical branch, no `$tbd` and no blocking findings in any screen | canonical page strictness |
| L12 duplicate-id | blocking | ids unique across the project | — |

Not carried over, because they are canvas geometry: section bounds and overlap, arrow elbow geometry and pass-through, component default residue by property comparison, colour token binding. They stay in `fig` and in whichever export adapter draws them.

## 6. Verbs — one set, two surfaces

Agents are the primary user. The CLI exists so CI and shell scripts can run the same thing.

| verb | in | out | writes |
|---|---|---|---|
| `lint [path]` | screens, conventions | findings JSON (`id, severity, screen, path, message`) + a summary line | no |
| `prep <screen>` | a screen file | the same file with missing required states stubbed as `$tbd` patches | yes, that file only |
| `diff <a> <b>` | two screen versions (files or git refs) | AS-IS/TO-BE table as JSON and markdown | no |
| `render [path]` | screens, tokens, a component set | one static HTML per screen, one section per state, real components, flows as links, every element linked to its YAML line | writes to `out/` |
| `import figma <file>` | a Figma file via MCP | screen files, one per `{screen}-{state}` frame group; geometry dropped, structure kept | yes, new files |
| `export <adapter>` | screens | canvas-specific output (Figma via `use_figma`, `.pen`, `.op`, HTML) | to the adapter's target |
| `rename <old> <new>` | a screen name | the file and every reference to it rewritten | yes, project-wide |

Figma import is the on-ramp for a team already drawing, so its heuristics are part of the contract: a frame group `{screen}-{state}` becomes one file with one state per frame; `kind` is found by reverse `maps_to` on the component master's name; `type` by reverse match of the `states.required` table against the states present; text layers become `text` props; anything unresolved lands as `$tbd` with the importer as owner, so the first `lint` after import is the to-do list.

MCP server: every verb is a tool with the same name and the same JSON output. Two additional read tools, because agents ask these more than anything: `get_screen(id)` (merged view for a given state) and `list_missing()` (the L03/L08 findings only).

### 6.1 Render draws with real components

`render` is how this project supports drawing without owning a canvas. Each `kind` resolves to a component: through `maps_to` when the team names a design system that ships a web build (antd, MUI, the team's own), otherwise through a bundled default set — one plain, tokenised HTML component per shipped `kind`. A `kind` nobody maps still renders, as the default. `tokens.json`, when present, themes the default set.

The result is a screen a designer can review — a table with its columns, a filter form with its fields, the empty notice where the table was — and every state of it on one page. Every rendered element carries its YAML path, so clicking it opens the line to change. The edit itself is to the file, by hand or by asking an agent ("drop the branch column"); the page re-renders. That loop — write, look, say what to change — is the agent-optimised form of drawing, and it needs no drag handles.

What `render` will not do, on purpose: free placement, pixel offsets, hand-tuned spacing. Those are geometry, and geometry goes to `export` — Figma, `.pen`, `.op` — where a hand belongs.

Output contract: **the JSON is the product; the markdown is a rendering of it.** A finding always has a file path and a YAML path so an agent can edit the exact line.

## 7. Lifecycle

`fig` implements canonical / working / queue / archive with page-name prefixes and divider groups because Figma has no branches. Here the same lifecycle costs nothing:

```
derived status      git                       who moves it
─────────────       ─────────────────────     ─────────────────────────
working             feature branch            the designer, freely
queue               PR open, lint passing     handoff (lint gate)
canonical           merged to main            merge = sync
archived            git history               nobody; it is already there
```

Status is derived, never stored: a stored field drifts (a file saying `working` while it sits on `main`), and a derived one cannot. `lint` learns the branch from git and applies L11 only on `lifecycle.canonical_branch`.

What this drops from `fig`: the `[Update] YYYY.MM` archive pages and the "shipped but not yet in canonical" divider — both workarounds for a tool without version control — and one thing that was genuinely useful: seeing the canonical and the working copy side by side on one page. Here that view is `diff` between two refs, rendered; it is not a canvas you scroll.

`handoff` is not a separate verb in v0: it is `lint` with `lifecycle.handoff_requires` applied, run as a PR check.

## 8. Extensibility — where a team's own values go

Everything a team might do differently is a key in `conventions.yaml`, and every such key ships `null` or empty so the check is skipped rather than firing wrongly on a file that does things another way. This is the `fig` repository's rule 4 ("generalize before it ships"), applied from day one.

| Varies by team | Where | Ships as |
|---|---|---|
| Screen types and their required states | `states.required` | three example rows, commented |
| Component vocabulary and its DS mapping | `kinds.*.maps_to` | a dozen generic kinds, no DS mapping |
| Which refs are mandatory | `refs.required` | `[]` |
| Naming patterns | `naming.*` | `null` |
| What handoff requires | `lifecycle.handoff_requires` | `[lint:blocking=0]` |
| Layout patterns | `layout` on a screen, list in conventions | `null` |

Adapters are separate packages with one interface: `import(source) -> Project` and `export(Project, target)`. The core never imports a canvas SDK.

## 9. Relationship to `fig` and `pm`

- `fig` keeps running on Figma as it does. Its `figma-conventions.yaml` splits conceptually into the semantic half (this project's `conventions.yaml`) and the rendering half (the Figma adapter's config). A migration script can derive the first from the second; the rendering keys are simply left behind.
- `pm:prd` writes the spec a screen's `refs.prd` points at; `pm:task-publish` opens the ticket `refs.task` points at. Neither needs to know this project exists — the link is a URI.
- `fig:draw`, `fig:proto`, `fig:code` become consumers: they read a screen file for structure and copy, and put geometry on top. That is the honest division of labour that `fig:draw` already gropes toward when it clones the nearest canonical screen.

## 10. Why this can be a service, and what "light" means here

A service here is not hosting a canvas. It is: a public schema, a validator anyone can run, adapters for the canvases people already use, and a place where the rules are versioned. The hosted form, if there is one, is a lint bot on pull requests and a rendered preview per branch — the same two things CI does for code.

"Light" is measured by what a new team must do on day one: put one YAML file per screen in a folder and run `lint`. No account, no canvas, no design system. Everything after that is optional.

## 11. TBD

| Item | Owner | Note |
|---|---|---|
| Name | user | `design-core` is provisional; the repository can be renamed and GitHub redirects the old address |
| License | decided | MIT (2026-09-23) — matches every open-source neighbour surveyed |
| Home repository | decided | github.com/byjunyoung/design-core (2026-09-23), separate from `claude-product-skills` whose changelog/version/two-README duties do not fit a product |
| Language of the core | user | Node fits the MCP ecosystem and `fig`'s scripts; Python fits `fig`'s config resolver. One, not both. |
| First adapter after Figma import | user | `.op` (MIT, JSON, MCP) or `.pen` (schema open, product closed) |
| Default component set | design | Which `kind`s ship a default HTML component and how far their styling goes. Decided 2026-09-23: real components, not boxes (§6.1); the list itself is open. |
| Platform / breakpoint variants | design | `{screen}-{state}` has no axis for mobile vs desktop. Candidates: a `variants:` block beside `states:` with the same patch shape, or one file per platform. A generic service meets this in its first week; v0 ships without it and says so. |
| Copy as literal vs key | design | `text: "No orders match."` is a literal today. Teams with i18n want `text: { key: orders.empty }`. Both shapes can coexist; `render` needs a message file for the second. |
