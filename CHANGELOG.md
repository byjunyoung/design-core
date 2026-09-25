# Changelog

## 0.12.1 — 2026-09-26

What filling in a real project showed — the kiosk sample drawn with tokens, contracts and assets of its own (DESIGN.md §13).

- **The bundled set reads type from the contract** where it used to fix a size: the page-header title, a field label, a hint; a segment and a stepper take a control height; the box of card, fieldset and modal no longer wraps a root an adapter drew (a double frame). A list cell draws its `value` and hides its chevron when told.
- **antd** — `size: full` is a block button and sm/md are small/middle; an `icon` that names an asset is drawn; a card's and a modal's body add no padding of their own, the contract's padding slot is the padding; a segment draws its `selected` option; the modal shadow is css, so the `shadow` slot replaces it.
- **A proposal records its file relative to the project.** Applying one in a copy of the project — a scratch copy, a checkout elsewhere — wrote back into the directory it was proposed in. It lands in the copy now; a record from before still applies, by its file name.

## 0.12.0 — 2026-09-25

Four more slots, so a contract can make a kiosk look like a kiosk (DESIGN.md §4.5).

- **`font-size`, `font-weight`, `min-height`, `shadow`** join bg, text, border, radius, padding, gap and accent as slots a contract binds a token to — on the kind, or per variant option (`size: { full: { min-height: control.xl } }`). Type reaches a bundled piece by inheritance from its wrapper; height and shadow the bundled set reads for button, card, image and modal; a root antd or MUI drew gets every bound slot applied from outside. `src/slots.js` is the one list.
- **Tokens to bind them to** — `font.size` is a scale now (xs · sm · md · lg · xl · 2xl), with `font.weight` (regular · medium · bold), `control` heights (sm · md · lg · xl — antd's small, middle, large and one more) and `shadow` (sm · md · lg, per theme) beside it, in the bundled set and in the files `init` writes. A flat `tokens.json` that still says `font.size: 14px` reads as before. antd takes `control.md` as its control height. `tokens --format tailwind` writes fontWeight, minHeight and boxShadow.
- **L28 slot-unknown** — a binding to a slot the picture does not read is a warning that lists the slots there are. A typo was silent.

## 0.11.0 — 2026-09-25

Handoff: what a developer — or a developer's agent — builds from (DESIGN.md §6.10).

- **`spec-<screen>.html`, `doan spec`, MCP `handoff`** — one spec read off the file: elements with props and copy and the component each maps to in code, what every state, variant and breakpoint changes, the flows out, the tokens with their CSS variables, the assets, the open `$tbd` questions, and acceptance criteria — a checklist line per promise the file makes. JSON for an agent, Markdown for a ticket (a copy button on the page). The screen page and the canvas frame panel link to it; the inspector shows an element's code snippet. The canvas panel's labels now read the page language (they were English regardless).
- **`maps_to.code` in a contract** — Code Connect's counterpart: import, name, prop and value mapping, from which every element's snippet is written. Shown on the component library page.
- **`doan tokens --format css | tailwind`** — the resolved set as custom properties, a block per theme, or a `theme.extend`.
- **`status: draft | ready | done`** on a screen, in the overview and the tree; **L27** warns when a ready screen still holds a `$tbd`; `list_screens` carries it; the draw prompt proposes `ready` when the person says so.

## 0.10.1 — 2026-09-25

Two things the owner's review called out as against the tool's own principles.

- **The contract is the one truth about a kind.** Until now a kind had three: its `components/<kind>.yaml`, the bundled drawing with defaults of its own (`el.size ?? 'md'`), and a library adapter that read whatever props its code knew. Now every element is drawn with its contract applied first — a default for each prop it left out, an enum value the contract does not list replaced by the declared default (L22 still reports it) — for the bundled set and adapters alike; and a contract's token bindings reach a piece an adapter drew: the page themes the antd or MUI root from the same `--k-<kind>-<slot>` variables (`.el-<kind>[data-drawn] > *`). Change a default or a binding in the contract and every picture follows.
- **Comments are anchored by element id.** A comment used to point at a YAML path (`elements.1`), which moves the moment something is inserted above it. It now carries the element's id; the path and line are derived from where the element is on every read, a comment whose element is gone says `orphan`, and one from before ids gets its id on read. `add_comment` takes `element` (preferred) or a path; the viewer's dots and drawer match by id.

## 0.10.0 — 2026-09-25

Responsive, both ways: product screens that adapt to width, and a viewer that does (DESIGN.md §4.7, §6.8).

- **Breakpoints.** `conventions.breakpoints` names the widths; a screen opts in with a `breakpoints:` block — per name, the patches a state would use, applied last. The screen page draws a frame per breakpoint beside the state tabs; the prototype gets a breakpoint select; the canvas keeps the base width. `get_screen` takes `breakpoint`, `list_screens` says which a screen has, the draw prompt asks about it. L26 warns on a breakpoint the conventions do not name; L07 and L18 cover breakpoint patches like any other.
- **Layout that adapts on its own**: `columns: auto` + `min`, `wrap: true`, `scroll: horizontal` — the three the field test wanted (§12, row 6). They reach a leaf kind's own row too.
- **The viewer fits narrow windows**: under 1180px the inspect panel becomes a toggle, under 860px the sidebar folds behind a menu button, the top bar goes to two rows and the tokens page to one column.
- The store-ops example's home screen shows it: 25 tiles per row on desktop, 20 on tablet, 10 on mobile; the stat strip wraps, then scrolls.

## 0.9.3 — 2026-09-25

- **Applying a proposal resolves the comments it answers.** `propose` takes `comments` — the ids of the open comments this version answers — and counts any id mentioned in its summary or decisions (the draw prompt writes `why: 코멘트 c_…`). `apply` resolves them with the approver's name and the proposal id as the resolution; a text-only change that applies at once resolves them as `auto`; `undo` reopens them. Until now the loop's last step, closing the comment, was done by hand (the kiosk's first comment was). CLI: `propose … --comments <id,id>`.

## 0.9.2 — 2026-09-25

- **`propose` takes a new screen.** Name a screen the project does not have and the proposal creates `screens/<name>.yaml` — always pending, since a new file is never a text-only change; the name must pass `naming.screen_pattern` and the YAML must say the same `screen:`. `apply` writes it only while the file is still absent; `undo` removes the file. The proposal page shows the new screen against an empty AS-IS. Until now a new screen had to be written by hand outside the edit loop (the kiosk's done screen was).

## 0.9.1 — 2026-09-25

- **The prototype selects nothing.** On `proto.html` a click used to do two things at once — follow the flow *and* select the element into the inspect panel — and an element with several flows opened a bare menu on top of that (the owner: "클릭이랑 컴포넌트 선택이랑 액션이 겹쳐서 혼란스럽네"). Now the page is interaction-only, the way Figma's present mode is: the inspector's click handler stands down, the panel says where the prototype is and lists the flows that leave this screen as buttons, and the chooser for an element with several flows carries a heading. Selecting elements is the canvas's job.

## 0.9.0 — 2026-09-24

The design system, seen: a tokens page, and assets — the person's own files — named from screens and seen on a page of their own (DESIGN.md §4.6, §6.9).

- **`tokens.html`** — laid out like Figma's variables modal: collections on the left (a base set's file, or a resolver modifier such as `theme` whose contexts are its mode columns), the groups of the one shown under them, and its table on the right — a heading per group, the name with a type mark, the value per mode, an alias as a chip with its name and colour. Search and group filters. A row opens the token in the inspect panel with every mode's value, its alias chain, the CSS variable and who uses it (contracts through their bindings, screens through layout gap and padding); `#t:<name>` and `#c:<collection>` deep-link. A flat `tokens.json` is one collection; the bundled set comes last when a token lives only there; the resolver's problems are listed on top.
- **Assets** — files under `assets/` (svg, png, jpg, gif, webp, avif). A screen names one by path: `src: assets/photos/menu.jpg` on an image, `icon: assets/icons/cart.svg` on any kind with an icon; anything else in `icon` stays a glyph. The bundled set draws the file itself; `serve` serves `/assets/…` from the folder and nothing outside it; `render` copies the folder next to the pages. `doan init` creates the folder.
- **`assets.html`** — a card per file under its folder, with its size, its natural dimensions and who names it; then the references that name no file and the files nothing names. A card opens in the inspect panel; `#a:<path>` deep-links to it.
- **L25** (warning): a `src` or `icon` that names a path under `assets/` with no such file.
- **`doan assets <dir>`** and MCP **`list_assets`**: the same summary for a person or an agent.
- The sidebar's design system: 개요, then **디자인 시스템 — 토큰 · 컴포넌트 · 에셋**, then the tree, because the screens are built from them.

## 0.8.0 — 2026-09-24

The workspace: the canvas page becomes the window Figma's viewer is — measured against it, editing aside (DESIGN.md §6.7).

- **Left, a tree**: domain → section → screen → state; under the selected frame, its element layers, hovering a row outlines the element, clicking selects and zooms to it. ⌘F searches screens.
- **Right, the inspect panel stays open** — an empty state until something is selected; a frame shows its file, type, platform, the flows leaving it, and links to the screen page and the prototype at that state; an element shows what the drawer showed.
- **Selection**: hover outlines the innermost element; a click selects an element or, on empty frame space, the frame; Esc clears; the tree, the frame and the URL follow.
- **Keys**: Shift 1 fit · Shift 2 zoom to selection · Shift 0 100% · ⌘/ctrl ± zoom · Esc.
- **Deep links**: `canvas-<domain>.html#screen.State/elements.1` opens zoomed to that element, selected; a selection writes the hash, so a review can be sent as a link to the exact element.
- **Two navigations, not one twice.** The left sidebar is content — the overview and the component library first, because the screens are built from them, then the domain tree — and the top bar is the modes of looking at it: Canvas · Prototype, the way Figma keeps Design · Prototype up there. Switching a mode keeps the sidebar and the context: the prototype opens on the selected frame. The duplicate links in the sidebar are gone; the arrows toggle is called "arrows", not "flows".
- **Defined once, worn by every page** (DESIGN.md §6.8): the same left column, the same top bar in the same order — where you are · the two modes · this page's tools and the theme — and the inspect panel on every page. The overview, the screen page, the proposal page and the component library now use it too; a screen in the tree links to its frame on the canvas. The overview opened at a domain and the prototype fold the tree from their hash and point the modes at that place, so the tree and the modes follow the prototype as you click through it. The top bar's three slots hold their positions: the modes are centred in the bar and the two sides share the rest equally, so nothing beside them moves them — a long meta truncates (full text on hover), wide tools wrap, and the prototype's screen and state selects carry their labels as tooltips to stay narrow.
- **The flow map is a section of the overview, not a mode.** The canvas already draws a domain's flows, so a second flow view was one thing twice (the owner's question, 2026-09-24). `flows.html` is gone; the ELK map of every domain — with the flows to nowhere and the screens no flow reaches under it — sits on the overview below the domain cards, and `index.html#<domain>` lights that domain in it.

## 0.7.0 — 2026-09-24

The domain canvas: the page a Figma file had per domain, rebuilt from the files.

- **`canvas-<domain>.html`** — a domain is what a section name says before " - " (`NN. {domain} - {feature}`). Its sections side by side, each a box; inside, one column per screen with the happy path first and the screen's other states stacked under its Default; frames at real size; zoom (⌘/ctrl + wheel, pinch, buttons) and pan (wheel, drag). The viewer's first surface: the sidebar and the overview open with the domains (DESIGN.md §6.6).
- **Arrows on the canvas**, drawn by the page from what it measures, by fig's arrow rules: from the source Default's right edge at the trigger element's height, a right-angle elbow, a gap before the head, into the target state frame's left edge; a flow that goes back climbs into a corridor above and comes down beside the target; `[state]` dashed chains between stacked frames; conditional dashed; label pills; a flow to another domain is a stub with a link.
- A comment on the canvas goes to the screen whose frame the element sits in, and a comment dot shows only in that screen's frames — the same path exists on every screen of a domain.
- The flow map's section titles link to the domain canvases.

## 0.6.0 — 2026-09-24

The click-through prototype: the product's navigation, pressed, from the files alone.

- **`proto.html`** (static and served): every screen in every state, one shown at a time. The elements a flow leaves from are hotspots; pressing one lands on the flow's target screen and state. `modal` and `sheet` lay the target over the current screen, `dismiss` and `back` pop, `replace` swaps. Several flows from one element open a chooser, conditional ones dashed. Start anywhere with `#screen` or `#screen.State`; the flow map's ▶ and the screen page's button link there (DESIGN.md §6.5).
- Not in scope, on purpose: typing, validation, branching on input — that is `fig:proto`.
- Fixed: a phone or tablet frame lost its bottom bezel in the viewer — `fit()` sized the stage to the frame and forgot the frame's own margin; a scaled frame also sat off-centre. Both stages now hold the whole frame, centred.

## 0.5.0 — 2026-09-24

The flow map: the whole product on one page, drawn from the files.

- **`flows.html`** in the viewer (static and served): a box per section, a node per screen — Default scaled to the platform's proportions, one row per state — and a right-angle arrow per flow that lands on the row of the state it names; `style: conditional` dashed; the label is the flow as written. Dead ends and screens no flow reaches are listed under it (DESIGN.md §6.4).
- **Layout by ELK** (`elkjs`, optional dependency). Ports and orthogonal routing are why: the arrows follow the discipline `fig:arrows` drew by hand. Without it the page says so; nothing else needs it.
- **`list_flows`** MCP tool and **L24**: a screen no flow reaches or leaves, once the project has flows.
- Nodes are `div`s with a link in the head, because a thumbnail drawn by a library adapter may hold links of its own.

## 0.4.0 — 2026-09-24

Kinds are files. The component library lives next to the screens, as text.

- **`components/<kind>.yaml`** is a kind's contract: `props` (type, required, default, enum options), `slots`, `anchors`, `maps_to`, `tokens` (slot → semantic token), `variants` (bindings per option), `sample`. `init` writes one for every bundled kind; `conventions.kinds` is gone from the example and the examples, still reads as legacy, and **`doan migrate kinds <dir>`** moves a project's rows into files (DESIGN.md §4.5).
- **Bindings drive the picture.** A contract's `tokens` become `--k-<kind>-<slot>` on the element, a variant's on `data-<prop>="<option>"`; the bundled set reads them with fallbacks. Change `button.yaml` and every button changes.
- **Compound components.** A contract with `elements` is drawn as that tree: `$name` for a prop, `${name}` inside text, `{ slot: name }` for a slot, `show_when: soldout` settled from props. Expanded after the state merge, so `set: { soldout: true }` is what the tree sees; children are `<instance>/<child>` and cannot be patched from the screen.
- **L21** warns on a prop a contract does not declare; **L22** blocks a missing required prop, an option the kind lacks, a slot it does not declare; **L23** is one line per project for rows still in `conventions.kinds`. L06 and L10 read the registry. Contract bindings go through L18/L19 like a layout does.
- **Components page** in the viewer: every contract drawn from its sample, one picture per variant option, with props, slots and bindings. `doan components <dir>`; MCP `list_components`; the `draw` prompt reads it and `list_tokens` before naming a kind.
- `map figma --write` writes `maps_to.figma` into the component file; `import figma` resolves kinds through the registry.
- Fixed on the way: `display-settings` in `examples/store-ops` had an unquoted comma in a `tooltip` value (L21 found it); `button-group` declares its `option` anchor.

## 0.3.0 — 2026-09-24

Tokens as a design system, not a colour list.

- **`tokens/` holds DTCG 2025.10 files** — `$value`, `$type`, `{alias}`, `$extends`; colour objects and `{ value, unit }` dimensions become css strings. The flat `tokens.json` from before still reads.
- **Two tiers by file.** `primitive.tokens.json` is the palette and the scale; the other files name it by alias. `conventions.tokens.primitive` lists the primitive stems and **L19** blocks a screen that names one. Token names in screens are unchanged (`space.md`).
- **Modes through a DTCG Resolver** — `theme.resolver.json` with sets, modifiers and `resolutionOrder`. `render` emits one custom-property block per context and a `theme` select in the header; the bundled kinds and the chrome follow it. A library adapter keeps the default context (DESIGN.md §4.4).
- **`doan tokens <dir>`** and the MCP tool **`list_tokens`**: every token with its value, per-theme values, file and tier, for an agent to read before naming one.
- **L18** warns on a layout token that resolves to nothing; **L20** relays what the loader could not resolve — a broken alias, an unreadable `$ref`, a token one theme has and another lacks.
- `init` writes `tokens/` (primitive, semantic, light, dark, resolver) instead of `tokens.json`; resolved for light it is exactly the bundled default.
- The `draw` prompt has a **wireframe step** again: a text sketch of every state in the conversation, and a yes, before any YAML is written. The first cut had replaced it with the rendered proposal; that made people argue with a diff (DESIGN.md §7).

## 0.2.1 — 2026-09-24

- **`kiosk` platform removed.** It was a portrait frame and nothing else. Built-in platforms are `web`, `ios`, `android`, `tablet`; a team that needs another size adds it under `conventions.platforms` with frame `tablet` or `none`.

## 0.2.0 — 2026-09-24

**design-core is now doan (도안).** 도안 is the Korean word for a design drawing — the plan a thing is made from. Same repository (GitHub redirects the old address), same files, same verbs.

- The command is `doan`; the MCP server is `doan`; the package is `@junyoung735/doan` on npm (the registry refuses bare `doan` as too similar to `dot`, `docz` and friends).
- Screen files say `schema: doan/0.2`. `design-core/0.2` is still accepted, so nothing you wrote breaks.
- The page's runtime globals are `DOAN_*`.

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
