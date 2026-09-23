# design-core

A design tool for product screens where the agent holds the pen. Humans review, comment and ask; nobody drags.

A screen is a YAML file the agent writes — elements, layout by tokens, every state, flows, the spec it answers to. The tool renders it with the team's real components, shows the states side by side, checks what is missing, and hands it to engineering as something a developer inspects rather than measures. Editing is a conversation anchored to the element you are looking at. Versions are git.

It replaces Figma for product screens. Decks, diagrams, vectors and marketing stay wherever they are.

The whole design, with the reason next to each decision, is in [DESIGN.md](DESIGN.md). Nothing runs yet — this repository is the design, and the name is provisional.

## Where it comes from

The rules are lifted from the [`fig` plugin](https://github.com/byjunyoung/claude-product-skills), run on one company's Figma files across several products since mid-2026. What migrates is the rule set; what stays behind is the Figma-only code.

## License

MIT
