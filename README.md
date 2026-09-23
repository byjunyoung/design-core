# design-core

A design tool for product screens where the agent holds the pen. Humans review, comment and ask; nobody drags.

A screen is a YAML file the agent writes — elements, layout by tokens, every state, flows, the spec it answers to. The tool renders it with the team's real components, shows the states side by side, checks what is missing, and hands it to engineering as something a developer inspects rather than measures. Editing is a conversation anchored to the element you are looking at. Versions are git.

It replaces Figma for product screens. Decks, diagrams, vectors and marketing stay wherever they are.

The whole design, with the reason next to each decision, is in [DESIGN.md](DESIGN.md). The name is provisional.

## What runs today

`lint` — validates every screen file against the schema and runs rules L01–L15 (missing states, dead flows, patches that target nothing, `$tbd` counts, layout outside the token vocabulary, variant shape, canonical-branch cleanliness).

`prep` — stubs every state the screen's type requires and the file lacks, as `$tbd` placeholders on one element. The file is rewritten in place with its comments intact; the next `lint` lists the placeholders as the to-do list.

`diff` — AS-IS / TO-BE between two versions of a screen, as a markdown table or JSON. Elements are compared by id, so a reorder is one row and a changed column list is one row. Works on two files or on a file against a git ref.

`render` — draws every screen with the bundled component set into static HTML: an index with lint counts per screen, and one page per screen with every state side by side, each variant axis in its own row, flows as links, and an inspector — click any element for its kind, the design-system component it maps to, its props, and the file, YAML path and line it came from. A `$tbd` shows as a chip where the value would be; a placeholder `prep` left shows as an undesigned box; `show_when` / `disabled_when` show as condition badges. Modals sit on a backdrop. No dependencies, no build; opens from a folder.

```bash
npm install
node src/cli.js lint examples/orders --branch feature/demo
#   warn   L08  examples/orders/screens/order-list.yaml:38  states.Error.0.replace.text  $tbd (pm, due 2026-10-02)
#   2 screens on feature/demo — 0 blocking, 1 warning
node src/cli.js lint examples/orders --branch main      # exit 1: a $tbd is not allowed on the canonical branch
node src/cli.js lint examples/orders --json             # the same, for agents and CI
node src/cli.js prep design/screens/new-list.yaml --owner design
#   design/screens/new-list.yaml: added Empty, Loading, Error as placeholders on "table"
node src/cli.js diff design/screens/order-list.yaml --from main
#   | Where | AS-IS | TO-BE |
#   | elements.table.columns | `["order_no","branch",…]` | `["order_no",…]` |
node src/cli.js render examples/store-ops --out out    # then open out/index.html
npm test
```

`examples/store-ops` holds six screens transcribed from a real admin (list, modal, inline detail, dashboard, tabbed settings) — what that transcription taught the format is in DESIGN.md §12.

Every finding carries the file, the YAML path and the line, so an agent can edit the exact spot. Not built yet: rendering with the team's own component library (antd, MUI) instead of the bundled set, `apply`, `import`, comments, and the MCP server.

## Where it comes from

The rules are lifted from the [`fig` plugin](https://github.com/byjunyoung/claude-product-skills), run on one company's Figma files across several products since mid-2026. What migrates is the rule set; what stays behind is the Figma-only code.

## License

MIT
