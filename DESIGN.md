# Doan — a design tool where the agent holds the pen

Status: design v0.2.1, code 0.1.0 · 2026-09-24 · license MIT · home github.com/byjunyoung/doan · named doan (도안) on 2026-09-24.

What runs: `lint` (schema + L01–L24), `prep`, `diff` (files or git refs), `render` (bundled component set, static HTML with inspector), as a CLI and as an MCP server on stdio (`mcp`; plus `list_screens`, `list_tokens`, `get_screen`, `list_missing`); the edit loop as `propose` → `apply` / `reject` / `undo` with text-only auto-apply. Not yet: hosting (the local viewer is the seed), adapters beyond antd. `prep`, `diff`, `render`, `apply`, `import` and the MCP surface are not built yet.

v0.1 (same day) framed this as a management layer that leaves drawing to other canvases. That was the author's reading, not the owner's. The intent is a tool a product team opens **instead of Figma** for its screens. v0.2 keeps v0.1's engine — the model, the checks, the lifecycle — and puts the product on top of it. Every decision carries a one-line *why*; one team's habit appears only as an example and ships as `null`.

## 1. What this is

A design tool for product screens in which **the agent draws and humans review, comment and ask. Nobody drags.** A screen is a file the agent writes; the tool renders it with the team's real components, shows every state side by side, checks what is missing, and hands it to engineering. Editing is a conversation, anchored to the element you are looking at.

Three products already let an agent draw. What they are, and where this differs:

- **Claude Design** (Anthropic Labs, 2026-04): prompt → prototype, edited by inline comments, direct text edit and sliders — no drag canvas, the same bet as here. It is single-seat, has no versioning, no per-screen states, no comment threads between people, and hands off as a bundle to Claude Code rather than as components a developer inspects ([review, 2026](https://agence-scroll.com/en/blog/claude-design-anthropic-2026-guide)). It is a generator for one person; this is a file of record for a team.
- **Paper** (alpha): HTML/CSS *is* the canvas, with bidirectional MCP — but a hand-driven canvas with an agent attached. This has no hand canvas at all.
- **pen.dev / OpenPencil**: a geometric `.pen`/`.op` document in the repo, agent-editable, hand-editable, IDE-native. A better Figma for developers; still a canvas.

What none of them hold, and this does: states per screen as required objects, a lint that says what is missing, a canonical/working lifecycle, and a handoff a developer can inspect at the component level. The engine of v0.1 is the differentiation; the viewer is the product.

### 1.1 Will Claude Design simply do this better?

At drawing a screen from a prompt — yes, and it will stay ahead; a generator built by the model's maker is not a fight to pick. So this project does not compete on generation at all. The agent that draws sits outside the tool (§7); Claude Code, Codex or Claude Design's own output can be the pen. What this holds is the layer a generator does not: the screen as a team's file of record, the check for what is missing, the lifecycle, the handoff. An editor, however good, does not make git unnecessary.

| | Claude Design (2026-09) | here |
|---|---|---|
| People | single-seat, no realtime | comments and PRs |
| Versions | none | git |
| States per screen | none | required per type, linted |
| Handoff | a bundle to Claude Code; code "not production-ready" | the team's production components, props inspectable |
| Where the result lives | a project on Anthropic's servers | YAML in the team's repo |
| Which agent | Claude | any, over MCP |

The risk is plain: the left column can be filled by Anthropic at will, versions and collaboration first. The bet is that "the team's file is in git and the agent is swappable" is a direction a model vendor has little reason to take. Open format, git-native, agent-neutral is the ground this stands on.

Rather than compete, the tool takes Claude Design as input: an `import html` adapter (§9) that reads the HTML it exports and produces screen files — `kind` by reverse `maps_to` on the component markup, layout from the flexbox/grid structure, the rest as `$tbd`. Claude Design becomes one front end among several; the question changes from "which draws better" to "where does the drawing live".

## 2. What Figma does for a product team, and what replaces it

"Replace Figma" is only honest as a table. This tool replaces Figma **for product screens**. Decks, FigJam diagrams, vector and illustration, marketing assets are out — a team keeps Figma or something else for those, and `fig:deck` in particular still depends on Figma Slides.

| Figma job | Here | v0 |
|---|---|---|
| Draw a screen | The agent writes the screen file; `render` draws it with real components | In |
| Look at screens | Project → screen list → a screen → its states side by side. No infinite canvas | In |
| Components & tokens | The team's code components and tokens, used directly. No Figma-side copy to keep in sync | In |
| Variants / states | `states:` in the file, required per screen type, checked by lint | In |
| Prototype links | `flows:` are links; the rendered screen is clickable | In |
| Dev Mode (inspect, measure, copy) | The render is real HTML/CSS built from the production component library; inspect props, not pixels | In |
| Comments | Anchored to an element (a YAML path); the agent reads them and proposes the change | In |
| Version history / branching | git. Working = branch, review = PR, canonical = main | In |
| Share link | Fixed URL per screen, state and version | In (hosted) |
| Find what is missing | Not in Figma. `lint` runs on every change | In |
| Hand-drag layout, pixel nudging | Out, on purpose (§6) | Out |
| Vector, illustration, icons | Out — icons come from the component library | Out |
| Slides, FigJam, marketing | Out | Out |
| Realtime multiplayer cursors | Out; collaboration is comments + PRs, not cursors | Out |
| Export to Figma / `.pen` / `.op` | Kept as one adapter, for teams that still need a canvas for something else. Not a pillar | later |

## 3. The model

Seven objects, unchanged from v0.1 except that a screen now carries its own presentation.

```
Project
 └─ Section            "03. Orders - Order list"
     └─ Screen         order-list · type: list   (status derived from git, §8)
         ├─ Element    id · kind · props · children       (the Default state)
         ├─ Layout     structure of the Default state, token-based, never px   (new in v0.2)
         ├─ Variant    what the screen *is* for this record or mode — axes, one option each, patches   (new in v0.2.1)
         ├─ State      what it is *doing* — Empty · Loading · Error … a patch on elements and layout
         ├─ Flow       from element[.anchor] → to screen[.state] · when
         ├─ Ref        prd: · task: · design: · file:     (typed URIs)
         └─ Decision   every value is set | $tbd{owner, due}
```

| Decision | Chosen | Why |
|---|---|---|
| Depth of an element | Shallow: `kind` + props, no geometry | Agents write and diff it reliably; the component library decides how a table looks. |
| **Presentation** | A `layout:` block — stack / grid / columns, alignment, size classes, spacing by **token name**, never raw px | Now that no canvas holds the arrangement, the agent's visual decisions must persist or every re-render loses them. Structure and tokens survive a design-system change and read in a diff; `px: 372` does neither. |
| How a state is stored | A patch on Default (`replace` / `hide` / `set`), for elements and layout alike | The reviewer's question is "what changes here", and a patch is that answer. |
| **Variants vs states** | `variants:` — named axes (`item_type`, `mode`), each with two or more options, each option a patch list; a view is Default → one option per axis, in declared order → the state | The field test (§12) found three screens whose "states" were really what the screen *is* for the record (a counted item, Edit mode), not what it is *doing*. Mixing them made `required` states meaningless and `known` a dumping ground. Same patch shape, so nothing new to learn. |
| Vocabulary of `kind` | Own small list, each with `maps_to` per design system | Screen files must survive a Bootstrap → antd move (happened 2026-09). |
| **Platform** | `platform:` on a screen, `platforms.default` in conventions; each platform has a width, an optional height and a frame (`none`, `phone`, `tablet`) | Screens are web or app. A kiosk platform shipped in 0.1.3 and was taken out (2026-09-24): it was only a portrait frame with no kiosk kinds, so naming it beside web and app promised more than it drew. The model never depended on a platform; the picture did — so the platform decides the frame and the width, the way `type` decides the required states. A per-screen field, because one project holds an admin web and a customer app of the same product. |
| Flow gestures and navigation | `gesture` and `nav` on a flow, vocabularies in `conventions.flows`, L16 | A tap and a swipe are different design facts; "push" and "sheet" change what the next screen looks like. Words the machine can read, not prose in `when`. |
| Identity | References use the `screen` name; a stable `id` exists only for `diff` pairing across renames; `rename` rewrites references | Humans and agents read `to: order-detail` without a lookup; lint L05 names any reference `rename` missed. |
| Undecided values | `{ $tbd: { owner, due } }`, a plain mapping under a reserved key | Visibly different from empty; survives every parser and JSON Schema; a YAML tag fails all four. |
| References | Typed URIs (`notion:`, `github:owner/repo#12`, `figma:`, `file:`) | A fixed pair would assume Notion and GitHub. |
| Screen type → required states | A table in conventions, three example rows | The `fig` rule that caught the most missing work; a team with no rows gets no check, not a wrong one. |

Why not adopt `.pen`, `.op` or AI Design Canvas's document: all three are geometry-first (frames, shapes, auto-layout) — checked 2026-09-23; none has states-per-screen, flows or lifecycle as first-class objects. Adopting one makes this a plugin of that canvas.

## 4. The file format

One screen, one file, YAML, validated by JSON Schema.

```
design/
├── conventions.yaml     naming, screen types, kinds, refs, lifecycle, layout vocabulary
├── tokens/              DTCG 2025.10 files and a resolver (§4.4); a flat tokens.json from before 0.3 still reads
├── sections.yaml        "03. Orders - Order list" and their order
└── screens/
    ├── order-list.yaml
    └── order-detail.yaml
```

### 4.1 A screen file

```yaml
schema: doan/0.2
id: scr_01J8K3                       # stable; only `diff` reads it
screen: order-list                   # the name every reference uses
section: "03. Orders - Order list"
type: list                           # decides required states
refs:                                # a map, one typed URI per key
  prd: notion:2a1f0d…
  task: github:acme/task-management#4155

elements:                            # the Default state
  - id: header
    kind: page-header
    title: Orders
    actions: [{ id: export, kind: button, label: Export, variant: secondary }]
  - id: filter
    kind: filter-form
    fields: [period, branch, status]
  - id: table
    kind: table
    columns: [order_no, branch, amount, status, ordered_at]
  - id: paging
    kind: pagination

layout:                              # structure, tokens, size classes — never px
  root: { kind: stack, direction: column, gap: space.lg, padding: space.xl }
  header: { align: space-between }
  filter: { kind: grid, columns: 3, gap: space.md }
  table: { grow: true }
  paging: { align: end }

states:                              # patches on elements and layout
  Empty:
    - { target: table, replace: { kind: empty-notice, text: "No orders match." } }
    - { target: paging, hide: true }
  Loading:
    - { target: table, replace: { kind: skeleton, rows: 10 } }
  Error:
    - { target: table, replace: { kind: error-notice, text: { $tbd: { owner: pm, due: 2026-10-02 } } } }

flows:
  - { from: table, via: row, to: order-detail }
  - { from: filter, to: order-list.Empty, when: "0 results", style: conditional }

notes:
  - The branch column is hidden for single-branch accounts.
```

`layout` vocabulary (`stack`, `grid`, `columns`, `align`, `grow`, size classes `sm|md|lg|full`) and the token names it may use are declared in `conventions.yaml`; lint L13 rejects anything else, and in particular any bare number with a unit.

### 4.2 Variants

```yaml
variants:                  # applied before any state, in the order the axes are declared
  item_type:
    Other: []              # an option may be empty; it still names the case
    Counted:
      - { target: level, replace: { kind: input, readonly: true } }
    CupLid:
      - { target: refill, hide: true }
  mode:
    Create: [{ target: delete, hide: true }]
    Edit:   [{ target: dialog, set: { title: Edit notice } }]
```

An axis needs two or more options (L15); one option is a state or a note. Option names must not shadow a state name (L15). Flows target `screen.State`, never a variant — a variant is chosen by the data, not reached by an action. `mergeState(screen, state, { item_type: 'CupLid', mode: 'Edit' })` gives the view.

### 4.3 conventions.yaml

The semantic half of `fig`'s `figma-conventions.yaml`, plus the layout vocabulary. Pixel values from `fig` (section gaps, arrow strokes) do not come along; they belong to the Figma export adapter if anyone builds one.

```yaml
naming:
  screen_pattern: '^[a-z0-9-]+$'
  section_pattern: null                         # example: '^\d{2}\. .+ - .+$'
states:
  known: [Default, Empty, Loading, Error, Validation, Selected]
  required:                                     # examples; a team writes its own rows
    list:   [Default, Empty, Loading, Error]
    form:   [Default, Validation]
    search: [Default, Empty]
# kinds are files — components/<kind>.yaml (§4.5). A kinds: block here still reads, as legacy; L23 asks to move it
layout:
  containers: [stack, grid, columns]
  spacing_tokens: 'space.'                      # prefix; only names starting with it may appear in layout
  size_classes: [sm, md, lg, full]
tokens:
  primitive: [primitive]                        # file stems under tokens/ a screen must never name (L19)
refs:
  required: []                                  # example: [prd]
  schemes: [notion, github, figma, file, https]
lifecycle:
  canonical_branch: main
  handoff_requires: [lint:blocking=0]
edit:
  auto_apply: [text]                            # which comment-driven changes skip preview (§7)
```

### 4.4 Tokens

```
design/tokens/
├── primitive.tokens.json   the palette and the scale — gray.900, blue.500, size.4
├── semantic.tokens.json    what does not change with the theme: space.md → {size.4}, radius, font
├── light.tokens.json       colour in the light theme: color.bg → {gray.0}
├── dark.tokens.json        colour in the dark theme: color.bg → {gray.900}
└── theme.resolver.json     sets, modifiers, resolutionOrder — how the files combine
```

Decided 2026-09-24, one question at a time, when the owner set the goal that doan carries everything the `fig` plugin used to keep in Figma — the design system, the components, the whole flow — not screens alone:

| Decision | Chosen | Why |
|---|---|---|
| Format | DTCG Format 2025.10 — `$value`, `$type`, `{alias}`, `$extends` | the first stable version of the spec; Figma Variables and Style Dictionary speak it, so tokens come in and go out without a converter of ours. Colour `$value` is an object (`colorSpace`, `components`, `hex`) and dimension is `{ value, unit }`; the loader turns both into css strings |
| Tiers | two — primitive → semantic | primitives are the design system's private vocabulary; screens and components name the semantic layer only. A third tier (component tokens) was judged too much for a small team — add a file when a team needs it |
| How a tier is marked | by file — `conventions.tokens.primitive` lists the stems | a name prefix (`primitive.blue.500`) would have changed every reference; a file boundary is visible in `ls` and in git |
| Names in screens | unchanged — `space.md`, as before | zero edits to existing screens and to the field-test project; the flat `tokens.json` from before 0.3 still reads (`source: flat`, no tiers) |
| Modes | DTCG Resolver — `theme.resolver.json` with sets, modifiers, contexts, resolutionOrder | the same document the spec's tooling exchanges; light/dark is a modifier, not a copy of the file. Spacing, radius and type sit in one set for every context, only colour is per theme, so nothing is repeated |

What the engine does with them: `loadTokens` resolves the default context into the nested shape render always read (`space.md` → `--space-md`) and every other context into its own set; `render` emits `:root[data-theme="dark"] { … }` per context and a select in the header that sets the attribute on `<html>`; `list_tokens` (verb and MCP tool) gives an agent every name with its value, its per-context values, its file and its tier before it names one. Lint: L18 a layout names a token that resolves to nothing; L19 a layout names a primitive; L20 whatever the loader could not resolve — a broken alias, a `$ref` it could not open, a token one theme defines and another does not. Nothing in the loader throws on a bad token; every miss is a finding with a file and a path.

Known limit: a component library adapter (antd, MUI) is themed at render time from the default context. The mode select recolours the bundled kinds and the page chrome, not the library's own pieces. Rendering once per context would close that at the cost of one server-side pass per theme — §13.

### 4.5 Components

```
design/components/
├── button.yaml        a bundled kind's contract: props, enum options, token slots, per-variant bindings
├── table.yaml         anchors and maps_to live here too — the file is the registry entry
├── menu-card.yaml     a compound part: props, a slot, and the elements it is drawn from
└── kinds.js           only with --base none: the drawing set, still yours
```

Decided 2026-09-24, right after the token stage, one question at a time:

| Decision | Chosen | Why |
|---|---|---|
| Where a kind is declared | one file per kind under `components/`; `conventions.kinds` is gone from `init` and from the examples | the owner chose the full move over keeping two places. A file is a thing a team owns and edits; a row in conventions was the tool's. A `kinds:` block still reads, as legacy — L23 (one line per project) and `doan migrate kinds` move it |
| What a contract holds | `props` (type, required, default, enum options), `slots`, `anchors`, `maps_to`, `tokens` (slot → semantic token), `variants` (bindings per enum option), `sample`, and for a compound part `elements` + `layout` | the facts a Figma component carries — properties, variants, the tokens it is bound to — as text a diff can read |
| Bindings reach the picture | `tokens:` becomes `--k-<kind>-<slot>` custom properties on the element's wrapper, a variant's on `[data-<prop>="<option>"]`; the bundled css reads them with fallbacks | the owner chose "in the picture" over "recorded and checked": change `button.yaml` and every button changes, as a library component would. Namespaced by kind so a card's padding never leaks into the button inside it; written as `var(--token)` so a theme switch flows through |
| What an instance may set | only declared props and slots. L21 warns on anything else; L22 blocks a missing required prop, an option the kind lacks, a slot it does not declare | the owner's rule: the screen holds the instance, the contract holds the part. A patch cannot reach inside — children are `<instance>/<child>`, a shape the screen schema forbids |
| Composition | `elements:` in the contract; `$name` is a prop's value, `${name}` its text inside a string, `{ slot: name }` a slot; a `show_when` that names a prop is settled; expanded after `mergeState`, before render | a state patch that sets a prop is what the tree sees; the inspector on an expanded child names the component file, not the screen |
| Required props | rare in the bundled set — a button's label, a caption's text, a field's label; never a list | a Figma import produces kinds without props; blocking every imported table on a missing columns list would fail the on-ramp on day one |

What the engine does with them: `loadComponents` reads `components/*.yaml` (and the legacy rows) into `project.components`; lint, render, `map figma` and `import figma` read only that. The viewer's **Components** page draws every contract from its `sample` — one picture, and one more per option of every prop with variant bindings — beside its props, slots and bindings; `list_components` (verb and MCP tool) is the same list as JSON, and the `draw` prompt reads it before naming a kind. `init` copies the bundled contracts into the project with `maps_to` trimmed to the chosen base.

Known limits: a library adapter (antd, MUI) draws from the props its own code reads — a contract's bindings and enum options do not reach it (§13). The shipped contracts were gated against five real projects (three examples, two field projects) for zero L21 before shipping; a prop a team uses that the bundled contract lacks is a one-line edit to a file they own, which is the point.

## 5. Lint catalogue

Blocking stops handoff; warning is reported and counted. Each rule names the `fig` rule it descends from.

| id | severity | checks | from fig |
|---|---|---|---|
| L01 name-pattern | blocking | screen and section names match the patterns | naming |
| L02 section-exists | blocking | `section` is a row in sections.yaml | frame membership |
| L03 required-states | blocking | every state `required[type]` lists is present | placeholder / coverage |
| L04 unknown-state | warning | a state not in `states.known` | naming |
| L05 flow-target | blocking | `flows.to` resolves to a screen or screen.state | arrow coverage |
| L06 flow-source | warning | `flows.from` is an element; `via` is an anchor its kind declares | arrow entry |
| L07 patch-target | blocking | a state or variant patch targets an element or layout key that exists | — |
| L08 tbd-count | warning · blocking when overdue | every `$tbd`, grouped by owner | placeholder text |
| L09 refs-required | warning | the refs `refs.required` names are present | task_tracker link |
| L10 kind-known | warning | every `kind` has a `components/<kind>.yaml` | component residue (loosely) |
| L11 canonical-clean | blocking | on the canonical branch: no `$tbd`, no blocking findings | canonical strictness |
| L12 duplicate-id | blocking | ids unique across the project | — |
| L13 layout-vocabulary | blocking | `layout` uses only declared containers, size classes and token names; no bare units | — (new) |
| L14 layout-orphan | warning | a `layout` key names an element that does not exist in that state | — (new) |
| L15 variant-shape | warning | a variant axis has ≥ 2 options; no option shares a name with a state | — (new) |
| L16 flow-vocabulary | warning | `gesture` and `nav` on a flow are words `conventions.flows` lists | arrow line styles |
| L17 platform-known | warning | a screen's `platform` is one `conventions.platforms` declares | — (new) |
| L18 token-missing | warning | a layout `gap` or `padding` names a token that resolves to nothing | — (new) |
| L19 token-primitive | blocking | a layout names a token from a file `conventions.tokens.primitive` lists | colour token binding (`fig:tokens`), moved from the canvas to the file |
| L20 token-problem | as the loader says | a broken alias, a `$ref` the resolver cannot open, a token one theme has and another does not | — (new) |
| L21 prop-undeclared | warning | an element, a replace patch or a set patch carries a prop its contract does not declare | component residue by property |
| L22 prop-invalid | blocking | a required prop is missing; an enum value is not an option; a slot is not declared | — (new) |
| L23 kinds-legacy | warning, one per project | rows still in `conventions.kinds` — `doan migrate kinds` | — (new) |
| L24 flow-orphan | warning | a screen no flow reaches or leaves, once the project has flows and more than one screen | coverage orphans |

Not carried over: section bounds and overlap, arrow elbow geometry, component default residue by property. All are canvas geometry; none exists here.

## 6. Render is the product surface

`render` was a preview in v0.1. In v0.2 it is what people open.

```
Shell (every page)
 ├─ Sidebar      sections → screens, each with pills: blocking · $tbd · open comments; Overview + waiting proposals
 ├─ Main         screen title · state tabs (Default | Empty | …, variants by axis) · "compare states" toggle
 │               one state at a time, scaled to fit; compare = every state, shrunk into a grid
 │               below: flows · notes · comments · references
 └─ Drawer       closed until an element is clicked: id, kind, component it maps to, conditions,
                 props, "values are samples", file · path · line, copy, comments + comment box
```

Redesigned 2026-09-24 after the owner's first look ("the UX/UI is poor"). Four decisions, each asked one at a time: the shell above (Figma's own editor shape, so it needs no explanation); states as tabs with a compare toggle (one screen large by default, all of them when you ask); meta information as a dot on the picture — grey for a condition, yellow for an undecided value, blue for a comment — with the words in the drawer, so the picture stays a picture; and empty cells filled with sample values made from the column name ("amount" → 12,400, "paid_at" → a date), with the drawer saying they are samples. Also fixed: a leaf element (a tile grid) was inheriting its layout rule's grid and collapsing to one column.

Each `kind` resolves to a component: through `maps_to` when the team names a design system with a web build (antd, MUI, the team's own), otherwise the bundled default set — one tokenised HTML component per shipped `kind`. `layout` becomes CSS from tokens. Because the page is built from the production library, a developer inspecting it sees the real `Table` with its real props. That is the handoff: no redlines, no measurement, no picture.

Shipped 2026-09-23 (v0.2.1): the page is finite by rule — the **states row** renders every state with no variant chosen, in `states.known` order; each **variants row** renders every option of one axis in Default; no cross product. The inspector is one fixed panel filled by one delegated click handler: id, kind, `maps_to` name (or "bundled default"), props, file, YAML path, line, and a copy button for `file:line`. A `developer` toggle prints every element's path on the page. A `$tbd` renders as a dashed chip in place of the value; a `placeholder` as a dashed "undesigned" box carrying its owner and note; `show_when` / `disabled_when` as muted condition badges — printed, never evaluated. A `type: modal` screen sits centred on a dimmed backdrop. Every gap and padding is a token variable; the CSS carries no spacing number. Verified in a browser: click the table on `inventory-list` → `elements.1.children.1`, line 28, which is `- id: table` in the file.

Shipped 2026-09-23, later: the first adapter, `antd`. `--components antd` resolves each kind through `maps_to.antd` and renders that component server-side with React and antd's style extraction, themed from the project's tokens (primary, danger, text, border, radius, font). Children the bundled renderer produced are embedded as HTML, so a Card holds whatever is inside it. A kind with no mapping keeps the bundled drawing, and the inspector still shows path and line, because the wrapper is the same. Verified in a browser on the field-test screens: a real `ant-table`, `ant-segmented`, `ant-empty`, `ant-pagination`; the edit modal's Validation state with antd inputs and a disabled primary button. The libraries are optional dependencies, loaded only when asked for.

Decided 2026-09-23 after the antd adapter: **the tool never owns a team's components, and no library is required.** `init` asks for a base — `none` copies the bundled set into `design/components/kinds.js`, which is then the team's own component library, editable, 100% theirs; `antd` maps kinds to a library (others are listed as planned and refused until an adapter exists). `render` resolves the choice from `conventions.render`, a project-owned module first, then a library, then the bundled set. The bundled set is a starting point a team copies, not a dependency a team keeps.

What render will not offer, on purpose: drag, resize, nudge. The moment a hand can move a box, the file and the picture can disagree, the diff stops being readable, and the product becomes one more canvas competing with three funded ones. The cost is real and named: a spacing change that would take one drag takes one sentence (§7).

### 6.4 The flow map

Shipped 2026-09-24 (0.5.0). The page Figma's flow page was: every screen of the product on one canvas, arrows between them, sections around them — except that nothing is placed by hand and nothing is stored. The files hold `flows:`; the layout is computed when the page is drawn.

| Decision | Chosen | Why |
|---|---|---|
| Engine | ELK (`elkjs`, the layered algorithm), an optional dependency | the owner compared it with dagre. dagre is 1.4 MB and gives a spline through a few points; ELK is 8 MB and gives **ports** and **orthogonal routing** — a flow to `kiosk-menu.Selected` lands on the "Selected" row of that node, bends at right angles, and enters from the left, which is exactly the arrow discipline `fig:arrows` drew and `fig:lint` checked. The 8 MB is install cost only: layout runs in node at render time and the page carries the result. Without it the page says so and everything else works |
| A node | a screen: its name, type and platform; Default drawn small in the platform's proportions; one row per state | the thumbnail is the same drawing the screen page shows, scaled; a state is a row so an arrow has somewhere to land |
| An edge | one per resolving flow, from the screen's right edge to the target's row; label `from.via · gesture · nav · when`; `style: conditional` dashed | the label is the flow as written; the person reads the file's words, not a paraphrase |
| Grouping | a box per section, in `sections.yaml` order; ELK places boxes as compound nodes and routes across them | sections are the product's own grouping; no second grouping to keep in sync |
| Coordinates | none stored, none adjustable | the owner chose auto-layout over saved positions: a map that re-draws from the files cannot drift from them |
| Dead ends and orphans | listed under the map; L24 warns on a screen no flow reaches or leaves | `fig:lint`'s coverage-orphan check, moved from the canvas to the graph |

Nodes are HTML (so an adapter's thumbnail is the real thing) and the edges are one SVG on top. A thumbnail may itself contain links (antd's pagination does), so a node is a `div` with a link in its head, not a link. `list_flows` (verb and MCP tool) is the same graph as JSON — edges, dead ends, orphans — for an agent that wants the structure without the picture.

## 7. The edit loop — "by conversation only"

A change enters as a comment or a chat message, anchored to what the person is looking at.

```
person    "table: drop the branch column"        (comment on the table, or chat)
agent     reads screen + conventions + comment
          proposes a patch: YAML diff + re-rendered screen, lint result attached
person    approves · edits the request · rejects
tool      applies to the working branch, re-renders, resolves the comment with a link to the commit
```

One tier rule so a typo does not cost a round trip: changes in `edit.auto_apply` (default: `text` — copy, labels, titles) that pass lint apply immediately, with undo. Everything else — elements, layout, states, flows — previews first. The owner chose conversation-only editing on 2026-09-23 knowing the cost; this rule is the floor under it.

Shipped 2026-09-23: `propose(screen, after)` takes the whole new YAML text — not a patch language, because an agent already writes whole files well and a patch language is one more thing to get wrong. The proposal stores the base file's hash; `apply` refuses if the file moved since. The tier is read off the diff: every changed path ending in a text prop (`text`, `label`, `title`, `placeholder`, `caption`, `hint`, `note`, `when`) or under `notes` is `text`; anything else is `structure`. `edit.auto_apply` names the tiers that skip the person; a tier still waits if lint after would block. Proposals are files under `.proposals/`, so the CLI, the MCP server and a future viewer share one queue. The MCP `apply` tool needs `approved_by` and its description tells the agent not to call it on its own — that is a convention, not a lock; the lock is that a person can always `undo`, and that the viewer (when it exists) is where approval is meant to happen.

Shipped later the same day — the sketch step. `fig:draw` agrees the direction in the conversation before a single node is written: the list of what must be decided, one question at a time with a recommendation, a table once settled, a text wireframe per state. The first cut dropped the wireframe on the theory that the real thing could replace it, since nothing is written until `apply`. The owner reversed that on 2026-09-24 after the first session that drew screens without one: the agent went straight from the decisions table to a rendered proposal, and the person had to argue with a diff and a picture instead of a sketch. So the wireframe stays, in the conversation, before any YAML — a box drawing of Default at the platform's proportions and one line per state — and the person says yes to it first. A wireframe is cheaper to argue with than a diff. After the yes, a proposal carries `decisions: [{ item, decision, why }]`, and `render` draws every pending proposal as a page — decisions, then the diff, then every state AS-IS beside TO-BE, with the inspector. The interview itself is agent behaviour, so the MCP server publishes it as the `draw` prompt: any agent that connects gets the same seven steps (anchor → list decisions → ask one at a time → table → wireframe and a yes → propose with decisions → render and wait). A proposal that arrives with no decisions renders with a line saying so — the page shows when the interview was skipped.

The agent behind the loop is not part of this project. The tool exposes MCP verbs (§9) and a comment feed; Claude Code, Codex or a hosted agent drives them. This keeps the tool small and lets a team bring the agent it already pays for.

## 8. Lifecycle

```
derived status      git                        what the tool shows
─────────────       ──────────────────────     ────────────────────────────────────
working             feature branch             preview link for that branch
queue               PR open, lint passing      PR comment: preview link + lint summary
canonical           merged to main             the project page; L11 enforced
archived            git history                version picker on the screen page
```

Status is derived, never stored — a stored field drifts. The PR view is what `fig` built with divider groups and `[Update]` pages: what shipped and is not yet canonical, side by side with what is.

## 9. Verbs — one set, three surfaces

The CLI is for CI. MCP is for the agent. The viewer is for people. Same verbs, same JSON.

| verb | does | writes |
|---|---|---|
| `lint` | findings with file path + YAML path | no |
| `prep <screen>` | stubs required states as `placeholder` patches carrying `$tbd`, on one element (`--target`, default the first); comments and order kept | that file |
| `diff <a> <b>` · `diff <file> --from <ref>` | AS-IS/TO-BE table; elements by id (a reorder is one row), scalar lists as one value, object lists by index; later rendered side by side in the viewer | no |
| `render` | the viewer's pages (static build, or served) | `out/` |
| `propose <screen> <after>` · `apply <id> --by` · `reject <id>` · `undo <id>` · `proposals` | the edit loop (§7): diff + lint delta + tier; text-only auto-applies; structure waits for a person | that file, and `.proposals/` |
| `rename <old> <new>` | file and every reference | project |
| `import html <dir>` | Claude Design / Open Design / any HTML export → screen files: `kind` by reverse `maps_to` on component markup, `layout` from flex/grid structure, unresolved → `$tbd` | new files |
| `map figma <key> --page [--write]` | the page's component masters (sets) paired with kinds by name → `maps_to.figma` in `components/<kind>.yaml` (the conventions row for a project from before 0.4); unplaced masters listed | component files |
| `tokens` | every token with its value, per-theme values, file and tier | no |
| `components` | every contract — props, slots, bindings, compound or not | no |
| `migrate kinds` | the rows of `conventions.kinds` → `components/<kind>.yaml`, the block dropped | components/, conventions.yaml |
| `import figma <key> --page` | on-ramp for a team already drawing, over the REST API: `{screen}-{state}` frames → files, other states as patches by diffing element trees; `kind` by `maps_to.figma` on the master name, then by node-name hints; `layout` from auto-layout in token names; flows from prototype links; scaffold frames (`[label]`, `-->`) skipped; unresolved → `$tbd` owned by `import`; required states nobody drew → placeholders; no convention at all → one screen per top-level frame, flagged | new files, sections.yaml |
| `export <adapter>` | Figma / `.pen` / `.op` for teams that still need a canvas elsewhere | adapter target |

MCP adds `list_screens()`, `get_screen(screen, state, variants)` (merged view), `list_missing()` (L03/L08 only), `list_tokens()`, `list_components()` and `list_flows()`, because agents ask those most. Shipped 2026-09-23: `src/mcp.js` on stdio via the official SDK; every tool returns the verb's JSON as `structuredContent` and as text, errors as `isError` with a readable message; one implementation per verb in `src/verbs.js` serves CLI and MCP alike.

## 10. The service

The engine (§3–§9) is open source and runs locally. The service is the engine hosted, which is what makes it a tool a team opens instead of Figma:

Shipped 2026-09-24 as `serve`: a local viewer that renders from the files on every request and adds the three things a static page cannot do — a comment box in the inspector (a comment is a screen + a YAML path + a text, stored in `.comments/<screen>.json`, shown as a badge on the element and as "N open" on the index), Apply / Reject on a proposal page with the approver's name, and `/api/lint`, `/api/proposals`, `/api/comments` for a bot or an agent. The MCP server reads and resolves comments, so the loop closes: a person comments on the page, the agent proposes, the person applies on the page, the agent resolves the comment naming the proposal. Verified in a browser by doing exactly that. Hosting is this process behind a URL per branch.

| Layer | What a person sees |
|---|---|
| Hosted viewer | the project page, always current with `main` |
| Per-branch preview | every PR gets a URL; reviewers look, not `git checkout` |
| Lint bot | a PR comment: missing states, dead flows, overdue `$tbd` |
| Comment → agent | comments on the viewer reach the agent; replies carry the diff and the preview |
| Fixed share links | screen + state + version, stable enough to paste into a ticket |
| Handoff | a link engineering opens; inspect real components; the version is pinned |

"Light" still means the same thing for a new team: put YAML files in a folder, run `lint`, open the viewer. No account until they want the hosted one; no canvas ever.

## 11. Relationship to `fig` and `pm`

- `fig` keeps running for teams on Figma. Its rules are this engine's rules; its Figma-only code stays there. Migration is `import figma` here.
- `pm:prd` writes what `refs.prd` points at; `pm:task-publish` opens what `refs.task` points at. Links are URIs; neither needs to know this exists.
- `fig:deck`, `fig:proto`, `fig:code`: `proto` becomes redundant (the render is clickable); `code` reads the screen file instead of Figma; `deck` stays on Figma Slides.

## 12. Field test — six real screens (2026-09-23)

Six screens of a working store-operations admin were transcribed into the format under generic names (`examples/store-ops`): an inventory list, its edit modal, a payment list with an inline detail, a notice create/edit modal with a delete confirm, a fleet dashboard, and a tabbed settings page. The structure came from the code, not from a mockup, so every conditional, timed and role-gated behaviour the code has was written down or noted as missing.

What it found, in the order it hurt:

| # | Finding | Kind | Resolution |
|---|---|---|---|
| 1 | The engine only saw top-level elements. Every real screen nests (card → filter → button; header → actions), so patches, flows and layout keys all missed — 20 blocking, 27 warnings on the first run | engine bug | fixed: an element is any `{id, kind}` object wherever it sits; merge, L06, L07, L10, L14 walk the tree |
| 2 | Prose values with commas in flow-style YAML (`{ when: Cancel, X or backdrop }`) parse as stray keys and fail the schema with a baffling message | authoring trap | schema errors now hint "quote the whole value"; the examples use block style for prose |
| 3 | Three of six screens have **variants** that are not lifecycle states: an edit modal that behaves as counted / cup-lid / other; a dialog that is Create or Edit; a home whose button reads Register or Edit by data | format gap | done: `variants:` (§4.2), L15; the three screens rewritten. Custom period stayed a state — it is reached by an action |
| 4 | Conditional visibility recurs on four of six screens: `show_when`, `disabled_when`, and a radio option that *reveals* its own control | format gap | accepted as element props for now (`show_when`, `disabled_when`, `reveals`); render and lint do nothing with them yet |
| 5 | Derived values (quantity = max × level, auto-filled max until edited), timed transitions (a 7-second overlay before reload), and role checks on button press rather than by hiding | not expressible | `notes:` — deliberately. These are behaviour, not screen structure; the format records that they exist, and the spec owns them |
| 6 | Responsive changes (3 columns → 2 on small; a stat strip that scrolls sideways) | format gap | still TBD (§12); two of six screens needed it |
| 7 | A detail shown under the list on the same page | awkward but works | a hidden element revealed by a `Selected` state |
| 8 | Modals as their own screen files (`type: modal`, `refs.parent`) with flows from the parent | works | keep |
| 9 | Two empty-state variants — "no data" vs "no match when filtered" — on every list | works | a team adds `NoMatch` to `states.known`; shows the extension point does its job |
| 10 | Button rows needed a bare container; `row` was a layout container, not an element kind | vocabulary | `group` kind added to the shipped set |

After the fixes: 6 screens, 0 blocking, 2 warnings — both `$tbd`, both real (an error state the build does not have; a help caption nobody captured).

### 12.1 Import field test (2026-09-24)

`import figma` was run against two real pages of the same company's files, read-only, output not committed. A page with **no naming convention** (every frame called by the product's name, groups called "3dots") imported zero screens until the fallback existed; with it, every top-level frame became a screen named by position and flagged — correct, and useless until a person names them. A page **kept by `fig`** (frames `{screen}-{state}`, sections `NN. domain - feature`, arrows drawn by `fig:arrows`) imported 10 "screens" on the first run, five of them arrow labels (`[label] A --> B`) — scaffold frames are now skipped by default — and blocked on Korean screen names until the pattern took `\p{L}` (the lint now compiles patterns with the `u` flag; the example says how). After that: 5 screens, 0 blocking, 954 warnings, of which 468 are `$tbd` — almost every element is `kind: frame` because the file's component masters are not in `maps_to.figma` and the layer names ("navigation", "right", "wrapper", "contents") say nothing a hint can read. That is the honest shape of an import from a file that was never written for this format: the structure and the states come across, the vocabulary does not, and the agent's next job is to walk the `$tbd` list with a person. Filling `maps_to.figma` from the design system's master names is what turns the ratio around, and is the first thing a team should do before importing — so `map figma` now does it: it reads the masters a page uses (variants collapsed into their component set), pairs each with a kind by name, and writes the pairs as lists into `conventions.yaml`. Three more things the same page taught, all now in the importer: a run of instances of one master (100 dashboard tiles) is one element with `repeat: 100`, not a hundred elements; a layer named by where it sits (`wrapper`, `contents`, `Frame 483913`) is a bare `group`, not an open question; a variant's own name is `type=primary`, so the resolver reads the component set's name. After all four: the same page, 5 screens, 0 blocking, **80 `$tbd`** (from 468) — 64 of them one master, `graph-item`, that no name hint can place and a person names once.

## 13. TBD

| Item | Owner | Note |
|---|---|---|
| Name | user | `doan` undersells a product; GitHub redirects after a rename |
| Core language | decided | Node (2026-09-23): MCP ecosystem, the viewer is web, `fig`'s scripts are JS. Deps: `yaml` (keeps line positions for findings) and `ajv` |
| Default component set | design | which `kind`s ship a bundled component and how far their styling goes |
| Layout vocabulary depth | design | v0.2 ships stack/grid/columns + tokens. Responsive rules (per breakpoint) are the next axis |
| Adapter theme per mode | design | antd and MUI pieces are themed once, from the default context (§4.4). Render per context when a team asks; it is one SSR pass per theme |
| Adapter reads the contract | design | antd and MUI pieces draw from the props their own code reads; a contract's enum options and bindings do not reach them (§4.5). An adapter could take `sample`, options and bindings from the registry |
| Contracts from Figma component sets | later | `map figma` pairs masters; a set's variant properties could fill a contract's enum options and its bound variables the bindings |
| Click-through prototype | next | on top of the flow map (§6.4): press the `from` element on a screen and land on the flow's target state, in one static page |
| Flow map label placement | design | ELK places a label anywhere along its edge; a long self-loop label can sit far from the node. `elk.edgeLabels.placement` and inline labels are the knobs to try |
| Platform / breakpoint variants | design | a `breakpoint` axis in `variants:`, or one file per platform. Two of six field-test screens needed it (§12) |
| Copy as literal vs key | design | `text: "…"` today; `text: { key: orders.empty }` for i18n teams |
| Comment storage | decided | a file per screen under `.comments/` in the repo (2026-09-24) — travels with the branch, one store for the local viewer, the MCP server and a hosted viewer |
| Agent runtime for the hosted loop | later | bring-your-own (Claude Code, Codex via MCP) first; a hosted agent is a pricing decision, not a design one |
