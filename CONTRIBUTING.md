# Contributing

Thanks for looking. A few things that keep this repository honest.

**Run everything before a change goes in.** `npm run check` runs the tests, lints both example projects and renders one. CI runs the same on Node 20 and 22.

**Tests first.** Every verb and every lint rule has a test that was written before the code and watched failing. Keep that: a new rule ships with one fixture that passes and one that fires; a new verb with a test that runs it end to end. `node:test`, no framework.

**Generalize before it ships.** Whatever prompted a change is one team's instance of it, not its definition. A rule goes in as the general shape — a state list a team writes for itself, a tracker that may be any tool, a component base that may be none — and the value that made you think of it goes into `conventions.example.yaml` as an example, or nowhere. Where a convention cannot be assumed, the key ships `null` and the check is skipped rather than firing on every file that does things differently.

**Examples stay generic.** `examples/` may be transcribed from real products, but under generic names: store, unit, item, material. No company names, product names, people, or internal URLs.

**Decisions carry their reason.** A change that decides something — a new object in the model, a new tier, a rule's severity — gets a line in `DESIGN.md` next to the decision, with the why. The document is the record; the code is what it currently says.

**Commit messages** say what changed and why, in a sentence, in whichever language you think in. The history here is Korean; that is fine.

**Template literals.** The viewer's CSS and JS live in template literals. A backtick inside them — in a comment, in a string — breaks the file. There is a note at the top of `src/render/page.js`.
