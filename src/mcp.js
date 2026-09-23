#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { lintProject, listMissing, listScreens, getScreen, prepScreen, diffScreen, renderProject } from './verbs.js';

// The agent's entrance. Same verbs as the CLI, same JSON; plus the two reads agents ask
// for most: the merged view of one screen, and only the findings that mean "missing".
//
//   design-core mcp <project-dir> [--branch <name>] [--today YYYY-MM-DD]
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

const server = new McpServer({ name: 'design-core', version: '0.0.1' });

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
    inputSchema: { out: z.string().optional().describe('output directory; default <project>/out') },
  },
  guard((input) => renderProject(dir, { ...common, out: input.out })),
);

await server.connect(new StdioServerTransport());
