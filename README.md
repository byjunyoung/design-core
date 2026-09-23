# design-core

A management layer for the screens that agents draw. Not a canvas.

One YAML file per screen — its type, elements, states, flows and the spec it answers to — and a set of verbs that keep those files honest: `lint`, `prep`, `diff`, `render`. Canvases (Figma, `.pen`, `.op`, Penpot) plug in underneath as importers and exporters; `render` draws the file with real components so a designer can review every state on one page.

The whole design, with the reason next to each decision, is in [DESIGN.md](DESIGN.md). Nothing runs yet — this repository is the design, and the name is provisional.

## Where it comes from

The rules are lifted from the [`fig` plugin](https://github.com/byjunyoung/claude-product-skills), which has been run on one company's Figma files across several products since mid-2026. What migrates is the rule set; what stays behind is the Figma-only code.

## License

MIT
