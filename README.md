# design-core

**Screens as files. The agent draws; you say what to change.**

Imagine every screen of your product is a short text file. It says what is on the screen, what it looks like when it is empty or loading or broken, where each button goes, and which spec it came from. An AI agent writes those files. You look at the drawn result, point at something, and say "drop that column" or "the empty message should be warmer" — and the file changes, with a diff you approve first.

That is the whole idea. No canvas, no dragging, no design file that drifts away from the code. The design is a file in your repo, next to the code, and everything that is missing is something a check can find.

> The name is provisional. This is a working engine and a local viewer; the hosted service around it is not built yet.

---

## What a screen file looks like

```yaml
screen: order-list
section: "03. Orders - Order list"
type: list                         # a list screen must have Empty, Loading and Error states

elements:
  - id: filter
    kind: filter-form
    fields: [period, branch, status]
  - id: table
    kind: table
    columns: [order_no, branch, amount, status, ordered_at]
  - id: paging
    kind: pagination

states:                            # what changes, and nothing else
  Empty:
    - { target: table, replace: { kind: empty-notice, text: "No orders match." } }
    - { target: paging, hide: true }
  Loading:
    - { target: table, replace: { kind: skeleton, rows: 10 } }
  Error:
    - { target: table, replace: { kind: error-notice, text: { $tbd: { owner: pm } } } }   # not decided yet — and it says so

flows:
  - { from: table, via: row, to: order-detail }

refs:
  prd: notion:2a1f0d…
  task: github:acme/task-management#4155
```

Three things to notice:

- **States are patches.** `Empty` does not repeat the whole screen; it says what is different. That is also what a reviewer wants to know.
- **`$tbd` is a real value.** An undecided text is not an empty string — it carries an owner and shows up as a yellow chip in the drawing and as a line in the to-do list.
- **The file knows where it came from.** `refs` point at the spec and the ticket, so nobody has to ask.

---

## What you can do with it

```bash
npm install
```

**See what is missing.**

```bash
node src/cli.js lint examples/orders --branch feature/demo
#   warn   L08  examples/orders/screens/order-list.yaml:38  states.Error.0.replace.text  $tbd (pm)
#   2 screens on feature/demo — 0 blocking, 1 warning
```

Fifteen rules: a list screen without an Empty state, an arrow that points at a screen that does not exist, a patch that targets nothing, a spacing typed as `16px` instead of a token, an undecided value that is overdue. Every line tells you the file, the path in the file, and the line number. On `main`, a `$tbd` is a blocking finding — the canonical branch stays clean.

**Fill in the blanks.**

```bash
node src/cli.js prep design/screens/new-list.yaml --owner design
#   design/screens/new-list.yaml: added Empty, Loading, Error as placeholders on "table"
```

The states the screen type requires but the file lacks are added as "undesigned" placeholders. The next `lint` lists them as work to do.

**See what changed.**

```bash
node src/cli.js diff design/screens/order-list.yaml --from main
#   | Where                  | AS-IS                              | TO-BE                    |
#   | elements.table.columns | ["order_no","branch","amount",…]   | ["order_no","amount",…]  |
```

Elements are compared by name, not position — reorder two of them and you get one row, not ten.

**Look at it.**

```bash
node src/cli.js render examples/store-ops --out out
#   7 pages → out/
```

Add `--components antd` and every kind that `conventions.yaml` maps to an antd component (`table: { maps_to: { antd: Table } }`) is drawn with the real thing, server-side, themed from your `tokens.json`; kinds with no mapping keep the bundled drawing. Other libraries are one adapter file each.

Open `out/index.html`. Each screen page shows every state side by side, and each variant (an edit dialog in Create mode and in Edit mode) in its own row. Click any element and a panel tells you what it is, which design-system component it maps to, its properties, and the exact file and line it came from. Undecided values are yellow chips; placeholders are dashed boxes; modals sit on a dimmed backdrop.

**Let the agent in.**

```json
{ "mcpServers": { "design-core": { "command": "node", "args": ["/path/to/design-core/src/mcp.js", "design"] } } }
```

Add that to Claude Code (or any MCP client) and the agent gets the same verbs, plus `list_screens`, `get_screen` (one screen, merged for a given state) and `list_missing` (only the to-do list).

**Change things by talking.**

The agent does not edit your files behind your back. It calls `propose` with a new version of one screen. You get back a diff, the lint result before and after, and a tier:

- A change that only touches text — a label, a message, a note — and keeps lint clean is applied at once. `undo` puts it back.
- Anything structural waits in `.proposals/` until you say `apply --by <your name>` or `reject`.

`apply` refuses if the file changed since the proposal was made, so two people never overwrite each other silently.

**Sketch before you write.** A new screen is not a diff you can judge — you need to see it. So a proposal can carry the decisions agreed before it was written (`item · decision · why`), and `render` draws every pending proposal as its own page: the decisions on top, what changes, then every state **AS-IS beside TO-BE**. The MCP server ships a `draw` prompt that walks the agent through it: anchor to the nearest screen, list what has to be decided, ask one question at a time with a recommendation, table the answers, propose with the decisions attached, render, wait.

```bash
node src/cli.js propose design order-list --with /tmp/order-list.new.yaml --summary "drop the branch column"
node src/cli.js proposals design
node src/cli.js apply design p_abc123 --by junyoung
```

---

## Why not just use Figma / Claude Design / a canvas?

They draw. This keeps. Figma has no idea that a list screen needs an Empty state, no lint, no `$tbd`, no git. Claude Design draws beautifully from a prompt but is single-seat, has no versions and no per-screen states, and hands off as a bundle rather than as components a developer can inspect. Paper and pen.dev are agent-friendly canvases — still canvases, still dragging.

This project takes the other side of the bet: the agent holds the pen, humans review and ask, and the design lives as a file of record with checks around it. Whatever draws the first version — Claude Code, Codex, Claude Design's HTML export one day — can be the pen. The full argument, and every decision with its reason, is in [DESIGN.md](DESIGN.md).

## What is not here yet

- Adapters for libraries other than antd (MUI, your own) — the adapter contract is one file, `src/render/adapters/antd.js` is the model.
- `import figma` — the on-ramp for a team that already drew everything.
- Comments on the rendered page (today a comment is what you tell the agent).
- Hosting: a viewer per branch, a lint bot on pull requests, share links. Everything above runs locally.

## Where the rules come from

The checks are lifted from the [`fig` plugin](https://github.com/byjunyoung/claude-product-skills), which has been run on one company's Figma files across several products since mid-2026. What migrated is the rule set — required states per screen type, `A --> B` flows, blocking vs warning, canonical vs working — not the Figma-only code. `examples/store-ops` is six real admin screens transcribed under generic names; what that transcription taught the format is in DESIGN.md §12.

## Tests and license

`npm test` — 82 tests, `node:test`, no framework. Dependencies: `yaml`, `ajv`, `@modelcontextprotocol/sdk`, `zod`; `antd`, `react`, `react-dom`, `@ant-design/cssinjs` are optional and only loaded by `--components antd`.

MIT.
