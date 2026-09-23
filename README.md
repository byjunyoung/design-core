# design-core

A design tool for product screens where the agent holds the pen. Humans review, comment and ask; nobody drags.

A screen is a YAML file the agent writes — elements, layout by tokens, every state, flows, the spec it answers to. The tool renders it with the team's real components, shows the states side by side, checks what is missing, and hands it to engineering as something a developer inspects rather than measures. Editing is a conversation anchored to the element you are looking at. Versions are git.

It replaces Figma for product screens. Decks, diagrams, vectors and marketing stay wherever they are.

The whole design, with the reason next to each decision, is in [DESIGN.md](DESIGN.md). The name is provisional.

## What runs today

`lint` — validates every screen file against the schema and runs rules L01–L14 (missing states, dead flows, patches that target nothing, `$tbd` counts, layout outside the token vocabulary, canonical-branch cleanliness).

```bash
npm install
node src/cli.js lint examples/orders --branch feature/demo
#   warn   L08  examples/orders/screens/order-list.yaml:38  states.Error.0.replace.text  $tbd (pm, due 2026-10-02)
#   2 screens on feature/demo — 0 blocking, 1 warning
node src/cli.js lint examples/orders --branch main      # exit 1: a $tbd is not allowed on the canonical branch
node src/cli.js lint examples/orders --json             # the same, for agents and CI
npm test
```

`examples/store-ops` holds six screens transcribed from a real admin (list, modal, inline detail, dashboard, tabbed settings) — what that transcription taught the format is in DESIGN.md §12.

Every finding carries the file, the YAML path and the line, so an agent can edit the exact spot. Not built yet: `prep`, `diff`, `render`, `apply`, `import`, and the MCP server.

## Where it comes from

The rules are lifted from the [`fig` plugin](https://github.com/byjunyoung/claude-product-skills), run on one company's Figma files across several products since mid-2026. What migrates is the rule set; what stays behind is the Figma-only code.

## License

MIT
