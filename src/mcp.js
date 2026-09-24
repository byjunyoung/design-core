#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { lintProject, listMissing, listScreens, getScreen, prepScreen, diffScreen, renderProject, importFigma, mapFigma, listTokens, listComponents, listFlows } from './verbs.js';
import { propose, applyProposal, rejectProposal, undoProposal, listProposals } from './proposals.js';
import { addComment, listComments, resolveComment } from './comments.js';

// The agent's entrance. Same verbs as the CLI, same JSON; plus the two reads agents ask
// for most: the merged view of one screen, and only the findings that mean "missing".
//
//   doan mcp <project-dir> [--branch <name>] [--today YYYY-MM-DD]
//
// Claude Code / Codex / any MCP client: { "command": "node", "args": ["src/mcp.js", "design"] }

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && argv[i + 1] !== undefined) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

const args = parseArgs(process.argv.slice(2));
const dir = resolve(args._[0] ?? 'design');
const common = { branch: args.branch, today: args.today, cwd: dir };

const server = new McpServer({ name: 'doan', version: '0.0.1' });

const reply = (json) => ({ content: [{ type: 'text', text: JSON.stringify(json, null, 2) }], structuredContent: json });
const fail = (err) => ({ content: [{ type: 'text', text: `error: ${err.message}` }], isError: true });
const guard = (fn) => async (input) => {
  try {
    return reply(await fn(input ?? {}));
  } catch (err) {
    return fail(err);
  }
};

server.registerTool(
  'list_screens',
  { description: 'Every screen in the project with its section, type, states and variant axes. Start here.', inputSchema: {} },
  guard(() => listScreens(dir)),
);

server.registerTool(
  'list_components',
  {
    description:
      'Every kind in the registry (components/<kind>.yaml): its props with types, required flags, defaults and enum options; its slots; the token slots it binds; whether it is a compound part drawn from its own elements. An instance in a screen may set only what its contract declares (L21, L22). Read this before writing an element.',
    inputSchema: {},
  },
  guard(() => listComponents(dir)),
);

server.registerTool(
  'list_flows',
  {
    description: 'Every flow in the product as one graph: edges that resolve (source screen, element, target screen and state, gesture, nav, condition), flows to nowhere, and screens no flow reaches. The flow map page draws the same graph.',
    inputSchema: {},
  },
  guard(() => listFlows(dir)),
);

server.registerTool(
  'list_tokens',
  {
    description:
      'Every token the project resolves: name, value in the default context, value per theme, the file that defines it, and its tier — primitive (the palette and the scale; a screen never names one, L19 blocks it), semantic (what layout and components name), bundled (the default set, no project file). Read this before naming a token in a layout.',
    inputSchema: {},
  },
  guard(() => listTokens(dir)),
);

server.registerTool(
  'get_screen',
  {
    description: 'The merged view of one screen: Default, then the chosen variant option per axis, then the state. Reports patch targets that do not exist.',
    inputSchema: {
      screen: z.string().describe('screen name, e.g. order-list'),
      state: z.string().default('Default').describe('a state name; Default is the elements as written'),
      variants: z.record(z.string(), z.string()).default({}).describe('one option per variant axis, e.g. { item_type: "Counted" }'),
    },
  },
  guard((input) => getScreen(dir, input)),
);

server.registerTool(
  'lint',
  { description: 'Schema check and rules L01–L15 over the whole project. Every finding has file, YAML path and line.', inputSchema: {} },
  guard(() => lintProject(dir, common)),
);

server.registerTool(
  'list_missing',
  { description: 'Only what is missing: required states a screen lacks (L03) and undecided values ($tbd, L08). The to-do list.', inputSchema: {} },
  guard(() => listMissing(dir, common)),
);

server.registerTool(
  'prep',
  {
    description: 'Stub every state the screen type requires and the file lacks, as placeholder patches carrying $tbd. Rewrites the file; comments kept.',
    inputSchema: {
      screen: z.string(),
      target: z.string().optional().describe('element id to attach the placeholder to; default the first element'),
      owner: z.string().optional().describe('who owes the design, written into each $tbd'),
    },
  },
  guard((input) => prepScreen(dir, input)),
);

server.registerTool(
  'diff',
  {
    description: 'AS-IS / TO-BE between two versions of a screen. Pass `before`+`after` as YAML texts, or `screen` with git refs `from` (default HEAD) and `to` (default the working file). Elements compare by id.',
    inputSchema: {
      screen: z.string().optional(),
      before: z.string().optional(),
      after: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    },
  },
  guard((input) => diffScreen(dir, input)),
);

server.registerTool(
  'render',
  {
    description: 'Draw every screen into static HTML (index + one page per screen, states side by side, inspector). Returns the file paths.',
    inputSchema: {
      out: z.string().optional().describe('output directory; default <project>/out'),
      proposal: z.string().optional().describe('a proposal id: also draw that proposal AS-IS beside TO-BE, every state'),
      components: z.string().optional().describe('a component library to draw mapped kinds with, e.g. "antd"; default the bundled set'),
    },
  },
  guard((input) => renderProject(dir, { ...common, out: input.out, proposal: input.proposal, components: input.components })),
);

server.registerTool(
  'propose',
  {
    description:
      'Propose a new version of one screen file (the whole YAML text). Returns the diff, lint before/after and a tier. ' +
      'A text-only change that keeps lint clean is applied at once (status "applied", undo available); anything else stays "pending" until a person applies or rejects it. ' +
      'Show the person the markdown and wait for their answer; do not call apply on your own.',
    inputSchema: {
      screen: z.string(),
      after: z.string().describe('the complete proposed YAML text of the screen file'),
      summary: z.string().default('').describe('one line: what changes and why, in the person\'s words'),
      decisions: z
        .array(z.object({ item: z.string(), decision: z.string(), why: z.string().optional() }))
        .default([])
        .describe('what was agreed with the person before this version was written; see the "draw" prompt'),
    },
  },
  guard((input) => propose(dir, input, common)),
);

server.registerTool(
  'list_proposals',
  { description: 'Proposals waiting for a person, oldest first (or all with status "all").', inputSchema: { status: z.string().default('pending') } },
  guard(async (input) => ({ proposals: await listProposals(dir, input) })),
);

server.registerTool(
  'apply',
  {
    description: 'Write a pending proposal to the file. Only after the person said yes in the conversation; approved_by is their name, and the call is refused without it or if the file changed since.',
    inputSchema: { id: z.string(), approved_by: z.string().optional() },
  },
  guard((input) => applyProposal(dir, input)),
);

server.registerTool(
  'reject',
  { description: 'Drop a pending proposal, with the reason the person gave.', inputSchema: { id: z.string(), reason: z.string().default('') } },
  guard((input) => rejectProposal(dir, input)),
);

server.registerTool(
  'undo',
  { description: 'Put back the previous text of a screen an applied proposal changed, if nothing else touched it since.', inputSchema: { id: z.string() } },
  guard((input) => undoProposal(dir, input)),
);

server.registerTool(
  'import_figma',
  {
    description: 'Bring a Figma page in as screen files: one per {screen}-{state} frame group, other states as patches, kinds via maps_to.figma then node names, unresolved values as $tbd. Needs FIGMA_TOKEN in the server environment. Refuses to overwrite unless force.',
    inputSchema: { file_key: z.string(), page: z.string(), force: z.boolean().default(false) },
  },
  guard((input) => importFigma(dir, { fileKey: input.file_key, page: input.page, force: input.force })),
);

server.registerTool(
  'map_figma',
  {
    description: 'Pair a Figma page\'s component masters with kinds by name (maps_to.figma). Dry run unless write; run before import_figma so kinds resolve instead of landing as $tbd. Returns mapped, already-set and unplaced masters.',
    inputSchema: { file_key: z.string(), page: z.string(), write: z.boolean().default(false) },
  },
  guard((input) => mapFigma(dir, { fileKey: input.file_key, page: input.page, write: input.write })),
);

server.registerTool(
  'list_comments',
  {
    description: 'Comments people left on the rendered screens, each anchored to a screen and a YAML path. These are the requests the edit loop turns into proposals. Open ones by default.',
    inputSchema: { screen: z.string().optional(), status: z.enum(['open', 'resolved', 'all']).default('open') },
  },
  guard((input) => listComments(dir, input).then((comments) => ({ comments }))),
);

server.registerTool(
  'resolve_comment',
  {
    description: 'Mark a comment handled — after the proposal that answers it was applied — with who resolved it and a note naming the proposal.',
    inputSchema: { id: z.string(), by: z.string().default('agent'), note: z.string().default('') },
  },
  guard((input) => resolveComment(dir, input)),
);

server.registerTool(
  'add_comment',
  {
    description: 'Leave a comment on an element on behalf of the person, anchored to a YAML path — for when they say it in chat and want it on the page.',
    inputSchema: { screen: z.string(), path: z.string(), text: z.string(), author: z.string().default('agent') },
  },
  guard((input) => addComment(dir, input)),
);

// The discipline behind a new or changed screen. fig:draw carried this as a skill document;
// here the server hands it to whichever agent connects, so every agent draws the same way.
server.registerPrompt(
  'draw',
  {
    title: 'Draw or change a screen',
    description: 'How to go from a request to a proposal the person can judge: anchor, list the decisions, ask one at a time, sketch every state as a text wireframe and get a yes, then propose with the decisions attached and render it.',
    argsSchema: { screen: z.string().describe('the screen to draw or change'), request: z.string().optional().describe('what the person asked for, in their words') },
  },
  ({ screen, request }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are about to draw or change the screen "${screen}"${request ? ` because the person asked: "${request}"` : ''}. Work in this order and do not skip a step.

1. Anchor. Call list_screens, then get_screen for "${screen}" if it exists and for its nearest relative if it does not (same section, same type). Call list_components — the kinds you may use and the props, slots and enum options each declares; nothing else goes on an element — and list_tokens — the semantic tokens a layout may name; never a primitive. Read conventions: the required states for its type, the layout vocabulary. New work inherits the shell every screen in the section shares.

2. List what has to be decided, numbered, before asking anything — so the person sees the size of it. Typical items: which elements, which columns or fields, which states beyond the required ones, where each action leads, what the empty and error copy says, what stays out of scope.

3. Ask one at a time. Each question gets two or three lines of context and a recommended option, based on the file's own precedent (how the sibling screens do it) rather than taste. Wait for the answer before the next question. If an answer opens a question the list did not have, ask that one next.

4. When everything is settled, show a table — item | decision | why — and the list of states the screen will have, one line each on what changes from Default.

5. Sketch before any YAML. In the conversation, draw the Default state as a text wireframe — a box drawing at the platform's proportions, every element in its place with its real label — and under it one line per other state on what the picture changes. Wait for a yes. If the person wants something moved, fix the sketch and show it again; a wireframe is cheaper to argue with than a diff.

6. Only then write the whole screen file and call propose with the complete YAML, a one-line summary in the person's words, and the decisions table from step 4 as the decisions argument. Then call render with that proposal id and give the person the page path: it shows the agreed decisions, what changes, and every state AS-IS beside TO-BE.

7. Wait. The person applies or rejects; you do not call apply yourself. If they ask for changes, go back to the sketch and propose again — the earlier proposal stays pending until it is rejected.

Copy comes from the spec the screen references, from sibling screens, or from the person; where none of those gives a value, write { $tbd: { owner: ... } } instead of something plausible. A value nobody decided is not a design decision.`,
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
