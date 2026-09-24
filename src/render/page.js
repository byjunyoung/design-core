// Page chrome for the viewer: the shell (sidebar · main · drawer), the state tabs and the
// compare toggle, the dots that stand in for meta information on the picture, and the one
// delegated click handler behind the drawer inspector. Sizes and colours come from tokens.
// NOTE: this file's strings are template literals — no backticks inside them, comments included.
export const CSS = `
:root { --size-sm: 240px; --size-md: 480px; --size-lg: 720px; --size-full: 100%; --side-w: 232px; --drawer-w: 340px; --ref-w: 1280px; }
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; font: var(--font-size)/1.45 var(--font-family); color: var(--color-text); background: var(--color-surface); }
a { color: inherit; text-decoration: none; }
.shell { display: grid; grid-template-columns: var(--side-w) minmax(0, 1fr) 0; min-height: 100vh; transition: grid-template-columns .15s ease; }
.shell.drawer-open { grid-template-columns: var(--side-w) minmax(0, 1fr) var(--drawer-w); }

/* sidebar */
.side { background: var(--color-bg); border-right: 1px solid var(--color-border); padding: var(--space-md) 0; position: sticky; top: 0; height: 100vh; overflow: auto; font-size: 13px; }
.side .brand { padding: 0 var(--space-md) var(--space-md); font-weight: 600; font-size: 14px; display: flex; align-items: baseline; gap: var(--space-sm); }
.side .brand .hint { font-weight: 400; }
.side .sec { padding: var(--space-sm) var(--space-md) 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-muted); }
.side-link { display: flex; align-items: center; gap: var(--space-xs); padding: 5px var(--space-md); color: var(--color-text); }
.side-link:hover { background: var(--color-surface); }
.side-link.current { background: var(--color-surface); font-weight: 600; box-shadow: inset 3px 0 0 var(--color-primary); }
.side-link .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { font-size: 10px; padding: 0 5px; border-radius: 8px; line-height: 15px; }
.pill.block { background: var(--color-danger); color: #fff; }
.pill.tbd { background: var(--color-tbd); border: 1px solid var(--color-tbd-border); }
.pill.cm { background: var(--color-primary); color: var(--color-primary-text); }
.side .base { margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-sm); }

/* main */
.main { min-width: 0; padding: 0 var(--space-lg) var(--space-xl); }
.top { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: var(--space-sm); padding: var(--space-md) 0; position: sticky; top: 0; background: var(--color-surface); z-index: 5; }
.top .where { min-width: 0; display: flex; align-items: baseline; gap: var(--space-sm); white-space: nowrap; overflow: hidden; }
.top .where .meta { overflow: hidden; text-overflow: ellipsis; }
.top h1 { font-size: 18px; margin: 0; }
.meta, .hint { color: var(--color-muted); font-size: 12px; }
.toggle { font-size: 12px; color: var(--color-muted); display: inline-flex; align-items: center; gap: var(--space-xs); cursor: pointer; white-space: nowrap; padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg); }
.toggle input { margin: 0; }
.toggle select { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
.toggle:has(input:checked) { color: var(--color-text); border-color: var(--color-primary); }
.tabs-row { display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap; margin: var(--space-xs) 0 var(--space-md); }
.tabs-row .axis { font-size: 11px; color: var(--color-muted); margin-right: var(--space-xs); }
.tab { padding: 4px 10px; border-radius: 999px; font-size: 12px; color: var(--color-muted); cursor: pointer; border: 1px solid transparent; background: none; font: inherit; }
.tab:hover { background: var(--color-bg); }
.tab.active { background: var(--color-bg); color: var(--color-text); border-color: var(--color-border); font-weight: 600; }
.tab .n { font-size: 10px; color: var(--color-muted); margin-left: 4px; }
.states { display: block; }
.state { display: none; }
.state.active { display: block; }
.stage { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.frame { width: var(--ref-w); transform-origin: 0 0; }
.view-root { min-height: 160px; }
.state h3 { display: none; font-size: 12px; margin: 0 0 var(--space-xs); color: var(--color-muted); }
/* compare: every state visible, shrunk to share the width */
.states.compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: var(--space-md); align-items: start; }
.states.compare .state { display: block; min-width: 0; }
.states.compare .state h3 { display: block; }
.section-title { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-muted); margin: var(--space-lg) 0 var(--space-xs); }
.list { margin: 0; padding-left: var(--space-lg); font-size: 13px; }
.list li { margin: 2px 0; }
.list code { background: var(--color-bg); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
.dead { color: var(--color-danger); text-decoration: line-through; }
.backdrop { background: rgba(31,35,40,.45); padding: var(--space-xl); display: flex; justify-content: center; min-height: 480px; }
.backdrop .modal-box { width: var(--size-md); }
.backdrop .view-root { border: 0; box-shadow: 0 8px 32px rgba(0,0,0,.25); padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); min-height: 0; }

/* device frames */
.frame.device-web { width: var(--ref-w); }
.frame.device-phone, .frame.device-tablet { width: var(--ref-w); background: var(--color-bg); border: 10px solid #1f2328; border-radius: 44px; overflow: hidden; margin: var(--space-md) auto; box-shadow: 0 12px 40px rgba(0,0,0,.25); display: flex; flex-direction: column; }
.frame.device-tablet { border-radius: 24px; }
.frame.device-phone .view-root, .frame.device-tablet .view-root { flex: 1; min-height: 0; overflow: hidden; }
.frame[style*="--ref-h"] { height: var(--ref-h); }
.status-bar { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 var(--space-lg); font-size: 12px; font-weight: 600; flex: 0 0 auto; }
.status-bar .notch { width: 120px; height: 28px; background: #1f2328; border-radius: 0 0 16px 16px; position: absolute; left: 50%; transform: translateX(-50%); top: 0; }
.status-bar { position: relative; }
.home-indicator { height: 20px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.home-indicator span { width: 134px; height: 5px; border-radius: 3px; background: var(--color-text); opacity: .8; }
.stage.stage-device { background: var(--color-surface); border: 0; display: flex; justify-content: center; }
/* mobile kinds */
.el-app-bar { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; min-height: 44px; padding: 0 var(--space-sm); }
.ab-back { font-size: 26px; color: var(--color-primary); padding: 0 var(--space-xs); } .ab-title { text-align: center; font-weight: 600; } .ab-actions { display: flex; gap: var(--space-xs); justify-content: flex-end; }
.tb { display: flex; border-top: 1px solid var(--color-border); background: var(--color-bg); } .tb-item { flex: 1; text-align: center; font-size: 10px; padding: 6px 0 8px; color: var(--color-muted); display: flex; flex-direction: column; align-items: center; gap: var(--space-xs); } .tb-item.on { color: var(--color-primary); } .tb-icon { width: 22px; height: 22px; border-radius: 6px; background: currentColor; opacity: .25; }
.el-tab-bar { margin-top: auto; }
.cell { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border); } .cell-thumb { width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-border); flex: 0 0 auto; } .cell-body { flex: 1; min-width: 0; } .cell-title { font-weight: 500; } .cell-sub { font-size: 12px; color: var(--color-muted); } .cell-trail { color: var(--color-muted); font-size: 13px; } .cell-chevron { color: var(--color-border); font-size: 20px; }
.el-list-cell .repeat { display: block; } .el-list-cell .rep { display: block; }
.sheet { background: var(--color-bg); border-radius: var(--radius-md) var(--radius-md) 0 0; box-shadow: 0 -8px 32px rgba(0,0,0,.15); padding: var(--space-sm) 0 var(--space-md); margin-top: auto; } .sheet-handle { width: 36px; height: 5px; border-radius: 3px; background: var(--color-border); margin: 0 auto var(--space-sm); } .sheet-title { font-weight: 600; text-align: center; margin-bottom: var(--space-sm); } .sheet-body { display: flex; flex-direction: column; gap: var(--space-md); padding: 0 var(--space-md); }
.el-bottom-sheet { margin-top: auto; }
.fab { position: absolute; right: var(--space-md); bottom: 72px; width: 56px; height: 56px; border-radius: 50%; border: 0; background: var(--color-primary); color: var(--color-primary-text); font-size: 24px; box-shadow: 0 6px 16px rgba(0,0,0,.25); }
.snack { margin: var(--space-sm) var(--space-md); padding: 10px 14px; border-radius: var(--radius-sm); background: var(--color-text); color: var(--color-bg); font-size: 13px; display: flex; justify-content: space-between; } .snack-action { color: #9bd1ff; font-weight: 600; }
.chip { display: inline-block; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--color-border); font-size: 12px; background: var(--color-bg); } .chip.on { background: var(--color-text); color: var(--color-bg); border-color: var(--color-text); }
.search { display: flex; align-items: center; gap: var(--space-xs); margin: 0 var(--space-md); padding: 0 var(--space-sm); background: var(--color-surface); border-radius: var(--radius-md); } .search input { border: 0; background: none; } .search-icon { color: var(--color-muted); }
.stepper { display: inline-flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin: 0 var(--space-md); } .step-btn { padding: 4px 12px; color: var(--color-primary); } .step-val { padding: 4px 12px; border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border); min-width: 32px; text-align: center; }
.ptr { text-align: center; color: var(--color-muted); font-size: 14px; height: 20px; } .ptr.on { color: var(--color-primary); }
.el-caption[data-props*='"style":"title"'] .caption { font-size: 20px; font-weight: 600; } .el-caption[data-props*='"style":"strong"'] .caption { font-weight: 600; }
.el-image .img.size-full { height: 240px; width: 100%; }
.el-button[data-props*='"size":"full"'] .btn, .el-button[data-size="full"] .btn { width: calc(100% - 2 * var(--space-md)); margin: 0 var(--space-md); padding: 12px; }
.el-button[data-props*='"variant":"icon"'] .btn { border: 0; background: none; color: var(--k-button-text, var(--color-primary)); padding: 4px; }
.gesture, .navkind { display: inline-block; font-size: 10px; padding: 0 5px; border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-muted); margin-left: 4px; }
/* index cards */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg); }
.scard { display: block; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md); }
.scard:hover { border-color: var(--color-primary); }
.scard .t { font-weight: 600; margin-bottom: 2px; }
.scard .m { font-size: 12px; color: var(--color-muted); margin-bottom: var(--space-sm); }
.scard .pills { display: flex; gap: var(--space-xs); flex-wrap: wrap; }
.pill.ok { background: var(--color-surface); color: var(--color-muted); border: 1px solid var(--color-border); }
table.index { width: 100%; border-collapse: collapse; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: 13px; }
table.index th, table.index td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--color-border); }
table.index th { color: var(--color-muted); font-weight: 500; font-size: 12px; }
.bad { color: var(--color-danger); font-weight: 600; }

/* the workspace: the canvas page keeps the panel open and the tree on the left */
.shell.workspace { grid-template-columns: var(--side-w) minmax(0, 1fr) var(--drawer-w); }
.shell.workspace .drawer { display: block; }
.views { display: flex; gap: var(--space-xs); }
.views a { padding: 4px 10px; border-radius: 999px; font-size: 12px; color: var(--color-muted); }
.views a.current { background: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); }
.tree-search { display: block; width: calc(100% - 2 * var(--space-md)); margin: 0 var(--space-md) var(--space-sm); padding: 5px 8px; font-size: 12px; }
.tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: var(--space-xs); min-width: 0; }
.tools select { max-width: 96px; }
.tree-domain-head { display: flex; align-items: center; gap: var(--space-xs); padding: 5px var(--space-md); font-weight: 600; }
.tree-domain-head .name { flex: 1; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-domain-head .hint { font-weight: 400; }
.tree-domain.current > .tree-domain-head { box-shadow: inset 3px 0 0 var(--color-primary); background: var(--color-surface); }
.tree-domain > .tree-body { display: none; } .tree-domain.open > .tree-body { display: block; }
.caret { width: 12px; font-size: 9px; color: var(--color-muted); cursor: pointer; text-align: center; flex: 0 0 auto; }
.caret::before { content: '\\25B8'; } .open > .tree-domain-head .caret::before, .open > .tree-screen-head .caret::before { content: '\\25BE'; }
.tree-screen-head .name { color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-screen.current > .tree-screen-head .name { font-weight: 600; }
.tree-sec { padding: var(--space-sm) var(--space-md) 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-muted); }
.tree-screen-head { display: flex; align-items: center; gap: var(--space-xs); padding: 4px var(--space-md) 4px 22px; }
.tree-screen-head .hint { margin-left: auto; }
.tree-screen > .tree-states { display: none; } .tree-screen.open > .tree-states { display: block; }
.tree-frame { display: block; padding: 3px var(--space-md) 3px 30px; color: var(--color-text); font-size: 12px; }
.tree-frame:hover { background: var(--color-surface); }
.tree-frame.current { background: var(--color-surface); font-weight: 600; box-shadow: inset 3px 0 0 var(--color-primary); }
.tree-el { padding: 2px var(--space-md); font-size: 11px; color: var(--color-text); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-el:hover { background: var(--color-surface); } .tree-el.current { background: var(--color-surface); font-weight: 600; }
.cv-body .el.hover { outline: 1px solid var(--color-primary); outline-offset: 1px; }
.cv-frame.selected .cv-body { outline: 2px solid var(--color-primary); outline-offset: 4px; }
.cv-frame.selected .cv-frame-title { color: var(--color-primary); }
/* the domain canvas — sizes are canvas pixels, scaled with the zoom, so they read like fig's page values */
.cv-main { display: flex; flex-direction: column; min-height: 100vh; }
.cv-wrap { position: relative; flex: 1; min-height: 480px; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: grab; user-select: none; }
.cv-wrap.dragging { cursor: grabbing; }
.cv-canvas { position: absolute; left: 0; top: 0; transform-origin: 0 0; --cv-col: 160px; --cv-frame: 96px; --cv-sec: 240px; --cv-pad: 96px; }
.cv-domain { display: flex; gap: var(--cv-sec); align-items: flex-start; padding: 120px; width: max-content; }
.cv-section { position: relative; padding: 112px var(--cv-pad) var(--cv-pad); border: 1px dashed var(--color-border); border-radius: 48px; background: rgba(107,114,128,.04); width: max-content; }
.cv-section-title { position: absolute; top: 32px; left: 44px; font-size: 22px; letter-spacing: .04em; text-transform: uppercase; color: var(--color-muted); white-space: nowrap; }
.cv-row { display: flex; gap: var(--cv-col); align-items: flex-start; }
.cv-col { display: flex; flex-direction: column; gap: var(--cv-frame); }
.cv-frame { position: relative; width: max-content; }
.cv-frame-title { display: block; font-size: 18px; color: var(--color-muted); margin-bottom: 8px; text-decoration: none; white-space: nowrap; }
.cv-frame-title:hover { color: var(--color-primary); }
.cv-body { background: var(--color-bg); box-shadow: 0 2px 16px rgba(0,0,0,.08); }
.cv-stage { display: block; } .cv-stage .frame { transform: none !important; margin: 0 !important; box-shadow: none; }
.cv-arrows { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.cv-arrow { fill: none; stroke: var(--color-muted); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.cv-arrow.conditional { stroke-dasharray: 12 8; }
.cv-chain { fill: none; stroke: var(--color-muted); stroke-width: 2; stroke-dasharray: 12 8; opacity: .6; }
.cv-label rect { fill: var(--color-bg); stroke: var(--color-border); rx: 8; } .cv-label text { font-size: 20px; font-weight: 500; fill: var(--color-muted); }
.cv-stub text { font-size: 20px; fill: var(--color-primary); } .cv-stub a { pointer-events: auto; }
#cv-arrow path { fill: var(--color-muted); }
body.cv-no-arrows .cv-arrows { display: none; }
.cv-bar .zoom { min-width: 56px; text-align: center; cursor: default; }
/* the click-through prototype */
.proto-bar .toggle select { max-width: 200px; }
.proto-stage { position: relative; }
.proto-view .stage { margin: 0 auto; }
.proto-overlay { position: fixed; inset: 0; background: rgba(31,35,40,.45); z-index: 20; display: flex; align-items: center; justify-content: center; padding: var(--space-xl); }
.proto-overlay[hidden] { display: none; }
.proto-choose { position: fixed; z-index: 30; display: flex; flex-direction: column; gap: var(--space-xs); padding: 6px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); box-shadow: 0 8px 24px rgba(0,0,0,.18); }
.proto-choose .btn { text-align: left; font-size: 12px; } .proto-choose .proto-cond { border-style: dashed; }
.proto-flows { display: flex; flex-direction: column; gap: var(--space-xs); } .proto-flows .btn { text-align: left; font-size: 12px; } .proto-flows .proto-cond { border-style: dashed; }
.proto-overlay .proto-view { width: min(92vw, 720px); max-height: 92vh; overflow: auto; }
.proto-overlay .proto-view .stage { box-shadow: 0 12px 40px rgba(0,0,0,.35); }
.hotspot { cursor: pointer; }
body.show-hotspots .hotspot { outline: 2px solid var(--color-primary); outline-offset: 2px; }
body.show-hotspots .hotspot-cond { outline-style: dashed; }
.flow-go { position: absolute; top: 8px; right: 8px; color: var(--color-muted); font-size: 11px; padding: 0 4px; text-decoration: none; } .flow-go:hover { color: var(--color-primary); }
/* the flow map */
.flow-scroll { overflow: auto; max-height: 70vh; margin-bottom: var(--space-lg); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); }
.flowmap { position: relative; }
.flow-head { display: block; color: inherit; text-decoration: none; } .flow-head:hover b { color: var(--color-primary); }
.flow-sec { position: absolute; border: 1px dashed var(--color-border); border-radius: var(--radius-md); }
.flow-sec.current { border-color: var(--color-primary); background: rgba(47,111,237,.04); }
.flow-sec-title { position: absolute; top: 10px; left: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-muted); white-space: nowrap; }
.flow-node { position: absolute; display: block; box-sizing: border-box; padding: 8px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: inherit; text-decoration: none; overflow: hidden; }
.flow-node:hover { border-color: var(--color-primary); }
.flow-head { height: 26px; line-height: 18px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.thumb { position: relative; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; }
.thumb-scale { transform-origin: 0 0; width: max-content; pointer-events: none; }
.thumb-stage { display: inline-block; }
.thumb-stage .frame { margin: 0; box-shadow: none; }
.flow-state { position: absolute; left: 8px; right: 8px; height: 18px; line-height: 18px; font-size: 11px; color: var(--color-muted); border-top: 1px solid var(--color-surface); }
.flow-edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.flow-edge { fill: none; stroke: var(--color-muted); stroke-width: 1.5; pointer-events: stroke; }
.flow-edge.conditional { stroke-dasharray: 5 4; }
.flow-label { font-size: 10px; fill: var(--color-muted); paint-order: stroke; stroke: var(--color-surface); stroke-width: 3px; }
#flow-arrow path { fill: var(--color-muted); }
/* the component library page */
.lib { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md) var(--space-lg); margin-bottom: var(--space-md); }
.lib h3 { margin: 0 0 2px; font-size: 15px; } .lib-meta { margin-bottom: var(--space-sm); font-size: 12px; }
.lib-row { display: flex; gap: var(--space-lg); align-items: flex-start; flex-wrap: wrap; margin: var(--space-sm) 0; }
.lib-pic { padding: var(--space-md); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-sm); min-width: 160px; max-width: 520px; }
.lib-pic .el-modal, .lib-pic .el-confirm, .lib-pic .el-bottom-sheet { max-width: 420px; }
.lib-variants { display: flex; gap: var(--space-md); flex-wrap: wrap; } .lib-variant .hint { font-size: 11px; margin-bottom: 4px; }
.lib table.props { font-size: 12px; width: auto; min-width: 360px; } .lib table.props td { vertical-align: top; }
/* elements */
.el { position: relative; }
.dots { position: absolute; top: 2px; right: 2px; display: flex; gap: var(--space-xs); z-index: 3; pointer-events: none; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.dot.cond { background: var(--color-muted); }
.dot.tbd { background: var(--color-tbd-border); }
.dot.cm { background: var(--color-primary); }
.el-card { padding: var(--k-card-padding, var(--space-md)); border: 1px solid var(--k-card-border, var(--color-border)); border-radius: var(--k-card-radius, var(--radius-md)); background: var(--k-card-bg, var(--color-bg)); display: flex; flex-direction: column; gap: var(--k-card-gap, var(--space-md)); }
.el-fieldset { padding: var(--k-fieldset-padding, var(--space-md)); border: 1px solid var(--k-fieldset-border, var(--color-border)); border-radius: var(--k-fieldset-radius, var(--radius-md)); background: var(--k-fieldset-bg, var(--color-bg)); display: flex; flex-direction: column; gap: var(--k-fieldset-gap, var(--space-md)); }
.el-section { display: flex; flex-direction: column; gap: var(--space-md); }
.card-title, .modal-title { font-weight: 600; }
.modal-body { display: flex; flex-direction: column; gap: var(--space-md); }
.el-page-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); }
.el-page-header h2 { font-size: 16px; margin: 0; }
.ph-actions { display: flex; gap: var(--space-sm); }
.tabs { display: flex; gap: var(--space-md); margin-top: var(--space-xs); }
.tabs .tab { padding: 0 0 2px; border-radius: 0; border: 0; border-bottom: 2px solid transparent; } .tabs .tab.active { background: none; border-bottom-color: var(--color-primary); }
.el-filter-bar, .el-group { display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; }
.el-filter-form { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: var(--space-sm); }
.fld { display: flex; flex-direction: column; font-size: 12px; color: var(--color-muted); gap: var(--space-xs); }
.el-field { display: grid; grid-template-columns: 160px 1fr; gap: var(--space-sm); align-items: start; }
.fld-label { font-weight: 500; }
input, textarea, .select { width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); font: inherit; color: var(--color-text); }
input.ro { background: var(--color-surface); color: var(--color-muted); }
.select { display: inline-block; width: auto; min-width: 120px; }
.err { color: var(--color-danger); font-size: 12px; }
/* --k-<kind>-<slot> come from the kind's contract (components/<kind>.yaml); the fallback is what the set drew before contracts existed */
.btn { padding: 6px 12px; border: 1px solid var(--k-button-border, var(--color-border)); border-radius: var(--k-button-radius, var(--radius-sm)); background: var(--k-button-bg, var(--color-bg)); color: var(--k-button-text, inherit); font: inherit; cursor: default; }
.btn-primary { background: var(--k-button-bg, var(--color-primary)); color: var(--k-button-text, var(--color-primary-text)); border-color: var(--k-button-border, var(--color-primary)); }
.btn-soft-primary { color: var(--k-button-text, var(--color-primary)); border-color: var(--k-button-border, var(--color-primary)); }
.btn-danger { color: var(--k-button-text, var(--color-danger)); border-color: var(--k-button-border, var(--color-danger)); }
.btn-icon { border: 0; background: none; color: var(--k-button-text, var(--color-primary)); padding: 4px; }
.btn[disabled], .is-disabled > .btn, .is-disabled input { opacity: .45; }
.seg { display: inline-flex; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
.seg span { padding: 4px 10px; } .seg .on { background: var(--color-primary); color: var(--color-primary-text); }
.radio { display: flex; gap: var(--space-md); } .radio label { display: inline-flex; align-items: center; gap: var(--space-xs); }
.dot-r { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--color-border); display: inline-block; } .dot-r.on { border: 4px solid var(--color-primary); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--k-table-border, var(--color-border)); }
th { color: var(--k-table-muted, var(--color-muted)); font-weight: 500; }
td .sub { color: var(--color-muted); font-size: 11px; }
.chk { width: 24px; }
.kv th { width: 30%; }
.bar { height: 8px; background: var(--color-surface); border-radius: 4px; overflow: hidden; } .bar span { display: block; height: 100%; background: var(--color-primary); }
.pager { display: flex; gap: var(--space-sm); align-items: center; } .pager .on { color: var(--color-primary); font-weight: 600; }
.notice { text-align: center; padding: var(--space-xl) var(--space-md); color: var(--color-muted); }
.notice-icon { font-size: 24px; } .notice-title { color: var(--color-text); font-weight: 600; margin-top: var(--space-xs); }
.notice.error .notice-icon { color: var(--color-danger); }
.notice-inline { margin-top: var(--space-md); padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.skel { height: 14px; margin: 8px 0; border-radius: 4px; background: linear-gradient(90deg, var(--color-surface), var(--color-border), var(--color-surface)); }
.overlay-box { padding: var(--space-md); text-align: center; background: rgba(255,255,255,.8); }
.toast { display: inline-block; padding: 6px 12px; border-radius: var(--radius-sm); background: var(--color-text); color: var(--color-bg); font-size: 12px; }
.toast.error { background: var(--color-danger); }
.el-placeholder { border: 2px dashed var(--color-placeholder-border); background: var(--color-placeholder); padding: var(--space-lg); text-align: center; color: var(--color-muted); }
.ph-label { text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
.tbd { display: inline-block; padding: 1px 6px; border: 1px dashed var(--color-tbd-border); background: var(--color-tbd); border-radius: var(--radius-sm); font-size: 11px; }
.el-unknown { border: 1px dashed var(--color-border); padding: var(--space-sm); border-radius: var(--radius-sm); }
.generic-head { font-size: 11px; color: var(--color-muted); text-transform: uppercase; }
.prop { display: flex; gap: var(--space-sm); font-size: 12px; } .prop .k { color: var(--color-muted); min-width: 80px; }
.stats { display: flex; gap: var(--space-lg); flex-wrap: wrap; } .stat-v { font-size: 20px; font-weight: 600; } .stat-l { font-size: 11px; color: var(--color-muted); }
.repeat { display: flex; flex-wrap: wrap; gap: var(--space-xs); } .rep { flex: 0 0 auto; }
.el-tile .tile { width: 36px; height: 36px; display: inline-block; }
.tiles { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: var(--space-xs); }
.tile { aspect-ratio: 1; border-radius: 2px; background: var(--color-border); } .t1 { background: #9bd1a5; } .t2 { background: #5aa86b; } .t3 { background: #e0b64a; } .t4 { background: #d1434b; }
.sortable { display: flex; flex-direction: column; gap: var(--space-xs); } .sort-item { padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.img { position: relative; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); display: grid; place-items: center; height: 80px; color: var(--color-muted); }
.img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.ico-img { width: 1em; height: 1em; vertical-align: -0.15em; }
/* the tokens page: a variables table per collection; the assets page: a card per file */
.tok { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: var(--space-lg); }
.tok th, .tok td { text-align: left; padding: 6px var(--space-sm); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.tok th { color: var(--color-muted); font-weight: 500; white-space: nowrap; }
.tok tr[data-token] { cursor: pointer; } .tok tr[data-token]:hover, .tok tr.current { background: var(--color-surface); }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--color-border); vertical-align: -3px; margin-right: var(--space-xs); }
.dim { display: inline-block; height: 8px; background: var(--color-primary); vertical-align: middle; margin-right: var(--space-xs); border-radius: 2px; max-width: 120px; }
.alias { font-size: 11px; color: var(--color-muted); }
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg); }
.asset { display: block; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); padding: var(--space-sm); cursor: pointer; color: var(--color-text); }
.asset:hover, .asset.current { border-color: var(--color-primary); }
.asset-pic { height: 96px; display: grid; place-items: center; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: var(--space-sm); background-color: var(--color-surface); background-image: linear-gradient(45deg, rgba(0,0,0,.05) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.05) 75%), linear-gradient(45deg, rgba(0,0,0,.05) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.05) 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px; }
.asset-pic img { max-width: 100%; max-height: 100%; }
.asset .t { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset .m { font-size: 11px; color: var(--color-muted); }
.side-link.sub { padding-left: 22px; }
/* the tokens page laid out like Figma's variables modal: collections and groups left, the table right */
.vars { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: var(--space-lg); align-items: start; }
.vars-side { position: sticky; top: 64px; }
.vars-search { width: 100%; margin: 0 0 var(--space-sm); }
.tok .grp td { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-muted); background: var(--color-surface); padding-top: 10px; }
.ticon { display: inline-block; width: 16px; margin-right: var(--space-xs); color: var(--color-muted); font-size: 11px; text-align: center; }
.chip { display: inline-flex; align-items: center; gap: var(--space-xs); padding: 1px 8px 1px 4px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.chip .swatch { margin-right: 0; }
.nav { display: flex; flex-direction: column; gap: var(--space-xs); min-width: var(--size-sm); } .nav-item { padding: 6px 10px; border-radius: var(--radius-sm); color: var(--color-muted); } .nav-item.on { background: var(--color-surface); color: var(--color-text); }
.chk-line { display: inline-flex; align-items: center; gap: var(--space-xs); } .box { width: 14px; height: 14px; border: 1px solid var(--color-border); border-radius: 3px; display: inline-block; } .box.on { background: var(--color-primary); border-color: var(--color-primary); }
.sw { display: inline-block; width: 28px; height: 16px; border-radius: 8px; background: var(--color-border); vertical-align: middle; } .sw.on { background: var(--color-primary); }
.tag { display: inline-block; padding: 0 6px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 11px; background: var(--color-surface); }
.row { display: flex; gap: var(--space-sm); align-items: center; } .row.end { justify-content: flex-end; }
.el.selected { outline: 2px solid var(--color-primary); outline-offset: 2px; }
body.dev .el::before { content: attr(data-path); position: absolute; top: -8px; left: 0; font-size: 9px; background: var(--color-text); color: var(--color-bg); padding: 0 4px; border-radius: 2px; z-index: 2; pointer-events: none; }

/* contract bindings for the rest of the set: every slot a bundled contract declares is read here, scoped by kind, with the old value as fallback */
.el-page-header h2 { color: var(--k-page-header-text, inherit); }
.el-section > .section-title { color: var(--k-section-text, inherit); }
.el-segmented .seg { border-color: var(--k-segmented-border, var(--color-border)); border-radius: var(--k-segmented-radius, var(--radius-sm)); } .el-segmented .seg .on { background: var(--k-segmented-bg, var(--color-primary)); color: var(--k-segmented-text, var(--color-primary-text)); }
.el-button-group .seg { border-color: var(--k-button-group-border, var(--color-border)); } .el-button-group .seg .on { background: var(--k-button-group-bg, var(--color-primary)); color: var(--k-button-group-text, var(--color-primary-text)); }
.el-segment .seg { border-color: var(--k-segment-border, var(--color-border)); border-radius: var(--k-segment-radius, var(--radius-sm)); } .el-segment .seg .on { background: var(--k-segment-bg, var(--color-primary)); color: var(--k-segment-text, var(--color-primary-text)); }
.el-pagination .pager .on { color: var(--k-pagination-text, var(--color-primary)); }
.el-detail-card th, .el-detail-card td { border-bottom-color: var(--k-detail-card-border, var(--color-border)); } .el-detail-card th { color: var(--k-detail-card-muted, var(--color-muted)); }
.el-kv-table th, .el-kv-table td { border-bottom-color: var(--k-kv-table-border, var(--color-border)); } .el-kv-table th { color: var(--k-kv-table-muted, var(--color-muted)); }
.el-empty-notice .notice { color: var(--k-empty-notice-muted, var(--color-muted)); } .el-empty-notice .notice-title { color: var(--k-empty-notice-text, var(--color-text)); }
.el-error-notice .notice { color: var(--k-error-notice-muted, var(--color-muted)); } .el-error-notice .notice-title { color: var(--k-error-notice-text, var(--color-text)); } .el-error-notice .notice-icon { color: var(--k-error-notice-accent, var(--color-danger)); }
.el-skeleton .skel { background: linear-gradient(90deg, var(--k-skeleton-bg, var(--color-surface)), var(--k-skeleton-border, var(--color-border)), var(--k-skeleton-bg, var(--color-surface))); }
.el-overlay .overlay-box { background: var(--k-overlay-bg, rgba(255,255,255,.8)); color: var(--k-overlay-text, inherit); }
.el-toast .toast { background: var(--k-toast-bg, var(--color-text)); color: var(--k-toast-text, var(--color-bg)); border-radius: var(--k-toast-radius, var(--radius-sm)); } .el-toast .toast.error { background: var(--k-toast-bg, var(--color-danger)); }
.el-modal { background: var(--k-modal-bg, var(--color-bg)); color: var(--k-modal-text, inherit); border-radius: var(--k-modal-radius, var(--radius-md)); padding: var(--k-modal-padding, 0); }
.el-confirm .confirm { background: var(--k-confirm-bg, var(--color-bg)); color: var(--k-confirm-text, inherit); border-radius: var(--k-confirm-radius, var(--radius-md)); }
.el-field .fld-label { color: var(--k-field-text, inherit); } .el-field .hint { color: var(--k-field-muted, var(--color-muted)); } .el-field .err { color: var(--k-field-accent, var(--color-danger)); }
.el-input input { background: var(--k-input-bg, var(--color-bg)); color: var(--k-input-text, var(--color-text)); border-color: var(--k-input-border, var(--color-border)); border-radius: var(--k-input-radius, var(--radius-sm)); }
.el-number input { background: var(--k-number-bg, var(--color-bg)); color: var(--k-number-text, var(--color-text)); border-color: var(--k-number-border, var(--color-border)); border-radius: var(--k-number-radius, var(--radius-sm)); }
.el-textarea textarea { background: var(--k-textarea-bg, var(--color-bg)); color: var(--k-textarea-text, var(--color-text)); border-color: var(--k-textarea-border, var(--color-border)); border-radius: var(--k-textarea-radius, var(--radius-sm)); }
.el-select .select { background: var(--k-select-bg, var(--color-bg)); color: var(--k-select-text, var(--color-text)); border-color: var(--k-select-border, var(--color-border)); border-radius: var(--k-select-radius, var(--radius-sm)); }
.el-date .select { background: var(--k-date-bg, var(--color-bg)); color: var(--k-date-text, var(--color-text)); border-color: var(--k-date-border, var(--color-border)); border-radius: var(--k-date-radius, var(--radius-sm)); }
.el-date-range .select { background: var(--k-date-range-bg, var(--color-bg)); color: var(--k-date-range-text, var(--color-text)); border-color: var(--k-date-range-border, var(--color-border)); border-radius: var(--k-date-range-radius, var(--radius-sm)); }
.el-upload .btn { background: var(--k-upload-bg, var(--color-bg)); color: var(--k-upload-text, inherit); border-color: var(--k-upload-border, var(--color-border)); border-radius: var(--k-upload-radius, var(--radius-sm)); }
.el-search-bar .search { background: var(--k-search-bar-bg, var(--color-surface)); color: var(--k-search-bar-text, inherit); border-radius: var(--k-search-bar-radius, var(--radius-md)); } .el-search-bar .search-icon { color: var(--k-search-bar-muted, var(--color-muted)); }
.el-radio { color: var(--k-radio-text, inherit); } .el-radio .dot-r { border-color: var(--k-radio-border, var(--color-border)); } .el-radio .dot-r.on { border-color: var(--k-radio-accent, var(--color-primary)); }
.el-nav .nav-item { color: var(--k-nav-muted, var(--color-muted)); border-radius: var(--k-nav-radius, var(--radius-sm)); } .el-nav .nav-item.on { background: var(--k-nav-bg, var(--color-surface)); color: var(--k-nav-text, var(--color-text)); }
.el-checkbox .box { border-color: var(--k-checkbox-border, var(--color-border)); } .el-checkbox .box.on { background: var(--k-checkbox-accent, var(--color-primary)); border-color: var(--k-checkbox-accent, var(--color-primary)); }
.el-switch .sw { background: var(--k-switch-border, var(--color-border)); } .el-switch .sw.on { background: var(--k-switch-accent, var(--color-primary)); }
.el-tag .tag { background: var(--k-tag-bg, var(--color-surface)); color: var(--k-tag-text, inherit); border-color: var(--k-tag-border, var(--color-border)); border-radius: var(--k-tag-radius, var(--radius-sm)); }
.el-caption .caption { color: var(--k-caption-text, inherit); }
.el-hint .hint { color: var(--k-hint-text, var(--color-muted)); }
.el-divider hr { border-color: var(--k-divider-border, var(--color-border)); }
.el-stat-strip .stat-v { color: var(--k-stat-strip-text, inherit); } .el-stat-strip .stat-l { color: var(--k-stat-strip-muted, var(--color-muted)); }
.el-tooltip .hint { color: var(--k-tooltip-text, var(--color-muted)); }
.el-image .img { background: var(--k-image-bg, var(--color-surface)); border-color: var(--k-image-border, var(--color-border)); }
.el-tile .tile.t0, .el-tile-grid .tile.t0 { background: var(--k-tile-border, var(--k-tile-grid-border, var(--color-border))); }
.el-placeholder { border-color: var(--k-placeholder-border, var(--color-placeholder-border)); background: var(--k-placeholder-bg, var(--color-placeholder)); color: var(--k-placeholder-text, var(--color-muted)); }
.el-sortable-list .sort-item { border-color: var(--k-sortable-list-border, var(--color-border)); border-radius: var(--k-sortable-list-radius, var(--radius-sm)); }
.el-progress .bar { background: var(--k-progress-bg, var(--color-surface)); } .el-progress .bar span { background: var(--k-progress-accent, var(--color-primary)); }
.el-app-bar { background: var(--k-app-bar-bg, transparent); color: var(--k-app-bar-text, inherit); } .el-app-bar .ab-back { color: var(--k-app-bar-accent, var(--color-primary)); }
.el-tab-bar .tb { background: var(--k-tab-bar-bg, var(--color-bg)); border-top-color: var(--k-tab-bar-border, var(--color-border)); } .el-tab-bar .tb-item { color: var(--k-tab-bar-muted, var(--color-muted)); } .el-tab-bar .tb-item.on { color: var(--k-tab-bar-accent, var(--color-primary)); }
.el-list-cell .cell { background: var(--k-list-cell-bg, transparent); color: var(--k-list-cell-text, inherit); border-bottom-color: var(--k-list-cell-border, var(--color-border)); } .el-list-cell .cell-sub { color: var(--k-list-cell-muted, var(--color-muted)); }
.el-bottom-sheet .sheet { background: var(--k-bottom-sheet-bg, var(--color-bg)); border-radius: var(--k-bottom-sheet-radius, var(--radius-md)) var(--k-bottom-sheet-radius, var(--radius-md)) 0 0; } .el-bottom-sheet .sheet-handle { background: var(--k-bottom-sheet-border, var(--color-border)); }
.el-fab .fab { background: var(--k-fab-bg, var(--color-primary)); color: var(--k-fab-text, var(--color-primary-text)); }
.el-snackbar .snack { background: var(--k-snackbar-bg, var(--color-text)); color: var(--k-snackbar-text, var(--color-bg)); border-radius: var(--k-snackbar-radius, var(--radius-sm)); }
.el-chip .chip { background: var(--k-chip-bg, var(--color-bg)); color: var(--k-chip-text, inherit); border-color: var(--k-chip-border, var(--color-border)); } .el-chip .chip.on { background: var(--k-chip-bg, var(--color-text)); color: var(--k-chip-text, var(--color-bg)); border-color: var(--k-chip-border, var(--color-text)); }
.el-stepper .stepper { border-color: var(--k-stepper-border, var(--color-border)); border-radius: var(--k-stepper-radius, var(--radius-sm)); } .el-stepper .step-btn { color: var(--k-stepper-text, var(--color-primary)); } .el-stepper .step-val { border-color: var(--k-stepper-border, var(--color-border)); }
.el-pull-to-refresh .ptr { color: var(--k-pull-to-refresh-text, var(--color-muted)); } .el-pull-to-refresh .ptr.on { color: var(--k-pull-to-refresh-accent, var(--color-primary)); }
.el-sheet-handle .sheet-handle { background: var(--k-sheet-handle-bg, var(--color-border)); }

/* drawer */
.drawer { position: sticky; top: 0; height: 100vh; overflow: auto; background: var(--color-bg); border-left: 1px solid var(--color-border); padding: var(--space-md); font-size: 12px; display: none; }
.shell.drawer-open .drawer { display: block; }
.drawer h4 { margin: 0 0 var(--space-xs); font-size: 13px; display: flex; align-items: center; gap: var(--space-sm); }
.drawer h4 .close { margin-left: auto; cursor: pointer; color: var(--color-muted); font-weight: 400; }
.drawer .k { color: var(--color-muted); }
.drawer table { font-size: 12px; } .drawer th { width: 34%; }
.drawer code { background: var(--color-surface); padding: 1px 4px; border-radius: 3px; word-break: break-all; }
.drawer textarea, .drawer input { width: 100%; margin: 4px 0; }
.drawer .cond-line { color: var(--color-muted); }
.drawer ul { padding-left: var(--space-md); margin: var(--space-xs) 0; }
`;

export const INSPECTOR_JS = `
(function () {
  var shell = document.querySelector('.shell');
  var panel = document.getElementById('inspector');
  var file = document.body.getAttribute('data-file') || '';
  var api = window.DOAN_API === true;
  var comments = window.DOAN_COMMENTS || [];
  var T = window.DOAN_I18N || {};
  function t(k, d) { return T[k] || d; }
  var selected = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // fit: each stage scales its reference-width frame to the width it has
  function fit() {
    document.querySelectorAll('.stage').forEach(function (stage) {
      var frame = stage.querySelector('.frame'); if (!frame) return;
      frame.style.transform = 'none';
      var w = stage.clientWidth; var ref = frame.offsetWidth || 1280;
      var s = Math.min(1, w / ref);
      frame.style.transform = 'scale(' + s + ')';
      // a device frame sits in a margin the transform does not scale; the stage must hold the
      // frame *and* that margin or the bottom bezel is cut. Centre it by hand: scale() shrinks
      // from the top-left, so margin:auto would leave it off-centre.
      var cs = getComputedStyle(frame);
      var my = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      if (frame.classList.contains('device-phone') || frame.classList.contains('device-tablet')) {
        var mx = Math.max(0, (w - ref * s) / 2) + 'px';
        frame.style.marginLeft = mx; frame.style.marginRight = mx;
      }
      stage.style.height = Math.ceil(frame.offsetHeight * s + my) + 'px';
    });
  }
  window.addEventListener('resize', fit);
  window.doanFit = fit; // the prototype page re-fits a view it has just shown

  // state tabs and compare toggle
  var states = document.querySelector('.states');
  document.querySelectorAll('.tab[data-state]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab[data-state]').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.state').forEach(function (s) { s.classList.remove('active'); });
      tab.classList.add('active');
      var target = document.getElementById(tab.getAttribute('data-target'));
      if (target) target.classList.add('active');
      fit();
    });
  });
  var compare = document.getElementById('compare');
  if (compare && states) compare.addEventListener('change', function () { states.classList.toggle('compare', compare.checked); fit(); });

  // mode selects: a token resolver axis (theme: light | dark) becomes data-<axis> on <html>,
  // which switches the custom properties to that context's set. Remembered per browser.
  document.querySelectorAll('select[data-mode]').forEach(function (sel) {
    var axis = sel.getAttribute('data-mode'); var key = 'doan.mode.' + axis; var saved = null;
    try { saved = localStorage.getItem(key); } catch (e) {}
    if (saved && Array.prototype.some.call(sel.options, function (o) { return o.value === saved; })) sel.value = saved;
    document.documentElement.setAttribute('data-' + axis, sel.value);
    sel.addEventListener('change', function () {
      document.documentElement.setAttribute('data-' + axis, sel.value);
      try { localStorage.setItem(key, sel.value); } catch (e) {}
    });
  });

  // comment dots on elements that have comments
  // a comment belongs to one screen; on a canvas that holds several, it lands only in that screen's frames
  function sameScreen(c, node) { if (!c.screen) return true; var f = node.closest('[data-screen]'); return !f || f.getAttribute('data-screen') === c.screen; }
  comments.forEach(function (c) {
    document.querySelectorAll('.el[data-path="' + c.path + '"]').forEach(function (el) {
      if (!sameScreen(c, el)) return;
      var dots = el.querySelector(':scope > .dots'); if (!dots) { dots = document.createElement('span'); dots.className = 'dots'; el.appendChild(dots); }
      if (!dots.querySelector('.cm')) { var d = document.createElement('i'); d.className = 'dot cm'; d.title = c.author + ': ' + c.text; dots.appendChild(d); }
    });
  });

  // drawer inspector: one delegated click
  function openDrawer(el) {
    window.DOAN_CURRENT_EL = el; // the canvas holds many screens; a comment goes to the frame the element sits in
    if (selected) selected.classList.remove('selected');
    selected = el; el.classList.add('selected');
    var props = {}; try { props = JSON.parse(el.getAttribute('data-props') || '{}'); } catch (_) {}
    var rows = Object.keys(props).filter(function (k) { return ['id', 'kind', 'show_when', 'disabled_when', 'reveals'].indexOf(k) < 0; }).map(function (k) {
      return '<tr><th>' + esc(k) + '</th><td>' + esc(typeof props[k] === 'object' ? JSON.stringify(props[k]) : props[k]) + '</td></tr>';
    }).join('');
    var path = el.getAttribute('data-path'), line = el.getAttribute('data-line'), maps = el.getAttribute('data-maps');
    var conds = [];
    if (props.show_when) conds.push('shown when: ' + props.show_when);
    if (props.disabled_when) conds.push('disabled when: ' + props.disabled_when);
    if (props.reveals) conds.push('reveals: ' + Object.keys(props.reveals).join(', '));
    var mine = comments.filter(function (c) { return c.path === path && sameScreen(c, el); });
    panel.innerHTML =
      '<h4>' + esc(el.getAttribute('data-id')) + ' <span class="hint">' + esc(el.getAttribute('data-kind')) + '</span><span class="close" id="close">×</span></h4>' +
      '<div class="hint">' + t('component', 'component') + ': ' + (maps ? esc(maps) : t('bundled', 'bundled default')) + '</div>' +
      (conds.length ? '<ul>' + conds.map(function (c) { return '<li class="cond-line">' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      '<table>' + rows + '</table>' +
      '<p class="hint">' + t('samplesNote', 'values shown in the picture are samples unless the file sets them') + '</p>' +
      '<p><span class="k">' + t('file', 'file') + '</span> <code>' + esc(file) + '</code><br><span class="k">' + t('path', 'path') + '</span> <code>' + esc(path) + '</code>' + (line ? '<br><span class="k">' + t('line', 'line') + '</span> <code>' + esc(line) + '</code>' : '') + '</p>' +
      '<p><button class="btn" id="copy">' + t('copy', 'copy path:line') + '</button></p>' +
      '<h4>' + t('comments', 'Comments') + '</h4>' + (mine.length ? '<ul>' + mine.map(function (c) { return '<li><b>' + esc(c.author) + '</b> ' + esc(c.text) + '</li>'; }).join('') + '</ul>' : '<div class="hint">' + t('noneOnElement', 'none on this element') + '</div>') +
      (api ? '<textarea id="ctext" rows="3" placeholder="' + t('sayWhat', 'say what should change') + '"></textarea><input id="cwho" placeholder="' + t('yourName', 'your name') + '"><button class="btn btn-primary" id="csend">' + t('send', 'Comment') + '</button> <span class="hint" id="cstate"></span>' : '<div class="hint">' + t('liveOnly', 'open the live viewer (doan serve) to comment') + '</div>');
    shell.classList.add('drawer-open');
    document.getElementById('close').addEventListener('click', function () { window.doanClearSelection(); });
    document.dispatchEvent(new CustomEvent('doan:select', { detail: { el: el } }));
    document.getElementById('copy').addEventListener('click', function () {
      var text = file + (line ? ':' + line : '') + '  ' + path;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      document.getElementById('copy').textContent = t('copied', 'copied');
    });
    var send = document.getElementById('csend');
    if (send) send.addEventListener('click', function () {
      var text = document.getElementById('ctext').value.trim(); var who = document.getElementById('cwho').value.trim();
      if (!text) return;
      fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screen: (window.DOAN_CURRENT_EL && window.DOAN_CURRENT_EL.closest('[data-screen]') ? window.DOAN_CURRENT_EL.closest('[data-screen]').getAttribute('data-screen') : window.DOAN_SCREEN), path: path, line: Number(line) || null, text: text, author: who || 'anonymous' }) })
        .then(function (r) { return r.ok ? location.reload() : r.json().then(function (j) { document.getElementById('cstate').textContent = j.error; }); });
    });
    fit();
  }
  // the workspace (a canvas page) keeps the panel open with an empty state instead of hiding it
  var emptyPanel = panel ? panel.innerHTML : '';
  window.doanSelect = openDrawer;
  window.doanClearSelection = function () {
    if (selected) selected.classList.remove('selected');
    selected = null;
    if (shell.classList.contains('workspace')) { panel.innerHTML = emptyPanel; } else { shell.classList.remove('drawer-open'); }
    document.dispatchEvent(new CustomEvent('doan:select', { detail: { el: null } }));
    fit();
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.el');
    if (document.body.getAttribute('data-mode') === 'proto') return;
    if (!el || e.target.closest('a') || e.target.closest('.drawer') || e.target.closest('.tab[data-state]')) return;
    e.preventDefault();
    openDrawer(el);
  });

  var dev = document.getElementById('dev');
  if (dev) dev.addEventListener('change', function () { document.body.classList.toggle('dev', dev.checked); });

  // the navigation tree every page carries: carets fold a domain or a screen, the search box
  // filters screens across every domain and opens what it finds. cmd/ctrl F goes to the box.
  document.querySelectorAll('.tree-domain-head .caret, .tree-screen-head .caret').forEach(function (c) {
    c.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); c.parentElement.parentElement.classList.toggle('open'); });
  });
  var treeSearch = document.getElementById('tree-search');
  if (treeSearch) {
    treeSearch.addEventListener('input', function () {
      var q = treeSearch.value.trim().toLowerCase();
      document.querySelectorAll('.tree-screen').forEach(function (s) {
        var hit = !q || s.getAttribute('data-screen').toLowerCase().indexOf(q) >= 0;
        s.hidden = !hit;
        if (q && hit) { s.classList.add('open'); var d = s.closest('.tree-domain'); if (d) d.classList.add('open'); }
      });
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); treeSearch.focus(); treeSearch.select(); }
    });
  }

  // a page whose place is only in its hash (index.html#domain, proto.html#screen.State) folds
  // the tree the way a server-placed page arrives: that domain open and current, on the
  // prototype the screen and its state too. Pages the server placed (canvas, screen) keep theirs.
  var serverPlaced = !!document.querySelector('.tree-domain.current');
  var treeFollow = function () {
    if (serverPlaced) return;
    var hsh = decodeURIComponent(location.hash.slice(1)).split('/')[0];
    if (!hsh) return;
    var q = function (sel, v) { return document.querySelector(sel + '="' + v.replace(/"/g, '') + '"]'); };
    var dom = q('.tree-domain[data-domain', hsh), screen = null, state = 'Default';
    if (!dom) {
      var parts = hsh.split('.');
      screen = q('.tree-screen[data-screen', parts[0]);
      if (parts[1]) state = parts[1];
      if (screen) dom = screen.closest('.tree-domain');
    }
    if (!dom) return;
    document.querySelectorAll('.tree-domain.current, .tree-screen.current, .tree-frame.current').forEach(function (n) { n.classList.remove('current'); });
    dom.classList.add('open', 'current');
    var fr = null;
    if (screen) {
      screen.classList.add('open', 'current');
      fr = screen.querySelector('.tree-frame[data-state="' + state.replace(/"/g, '') + '"]');
      if (fr) fr.classList.add('current');
    }
    // the modes keep this place too: the canvas at the frame (or the domain), the flow map at
    // the domain, the prototype at this screen and state (or the domain's first screen)
    var views = document.querySelector('nav.views');
    if (!views) return;
    var cv = views.querySelector('a[href^="canvas-"]'), pr = views.querySelector('a[href^="proto.html"]');
    var here = fr || (screen && screen.querySelector('.tree-screen-head a.name')) || dom.querySelector('.tree-domain-head a.name');
    var firstScreen = screen || dom.querySelector('.tree-screen');
    if (cv && here) cv.setAttribute('href', here.getAttribute('href'));
    if (pr && firstScreen) pr.setAttribute('href', 'proto.html#' + firstScreen.getAttribute('data-screen') + (screen && state !== 'Default' ? '.' + state : ''));
  };
  window.doanTreeFollow = treeFollow;
  treeFollow();
  window.addEventListener('hashchange', treeFollow);

  // proposal page: apply / reject
  var approve = document.getElementById('approve'), reject = document.getElementById('reject');
  function verdict(kind) {
    var by = (document.getElementById('by') || {}).value || '';
    var id = (approve || reject).getAttribute('data-id');
    if (kind === 'apply' && !by.trim()) { document.getElementById('verdict').textContent = t('nameFirst', 'your name first'); return; }
    fetch('/api/proposals/' + id + '/' + kind, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'apply' ? { by: by } : { reason: by }) })
      .then(function (r) { return r.json(); }).then(function (j) { document.getElementById('verdict').textContent = j.error ? j.error : j.status; if (!j.error) setTimeout(function () { location.href = '/'; }, 600); });
  }
  if (approve) approve.addEventListener('click', function () { verdict('apply'); });
  if (reject) reject.addEventListener('click', function () { verdict('reject'); });

  fit();
})();
`;

// The prototype page's own script: a stack of views, hotspots from the flows, hash routing.
// No template literal inside — this string is embedded into one.
export const PROTO_JS = `
(function () {
  var flows = window.DOAN_FLOWS || [];
  var views = Array.prototype.slice.call(document.querySelectorAll('.proto-view'));
  // the prototype selects nothing: the inspector's click handler stands down on this page
  document.body.setAttribute('data-mode', 'proto');
  var T = window.DOAN_I18N || {}, panel = document.getElementById('inspector');
  var screenSel = document.getElementById('proto-screen'), stateSel = document.getElementById('proto-state');
  var back = document.getElementById('proto-back'), hot = document.getElementById('proto-hot'), overlay = document.getElementById('proto-overlay');
  var stack = [];
  function statesOf(screen) { return views.filter(function (v) { return v.getAttribute('data-screen') === screen; }).map(function (v) { return v.getAttribute('data-state'); }); }
  function viewOf(screen, state) {
    var exact = views.filter(function (v) { return v.getAttribute('data-screen') === screen && v.getAttribute('data-state') === state; })[0];
    return exact || views.filter(function (v) { return v.getAttribute('data-screen') === screen; })[0] || null;
  }
  function top() { return stack[stack.length - 1]; }
  function lineOf(f) { return f.label + ' \\u2192 ' + f.to + (f.state !== 'Default' ? '.' + f.state : ''); }
  // one listener per element; an element several flows leave from asks which one
  function arm(root, screen) {
    var mine = flows.filter(function (f) { return f.screen === screen; });
    var byFrom = {};
    mine.forEach(function (f) { (byFrom[f.from] = byFrom[f.from] || []).push(f); });
    Object.keys(byFrom).forEach(function (from) {
      var list = byFrom[from];
      root.querySelectorAll('.el[data-id="' + from + '"]').forEach(function (el) {
        el.classList.add('hotspot');
        if (list.every(function (f) { return f.style === 'conditional'; })) el.classList.add('hotspot-cond');
        el.setAttribute('title', list.map(lineOf).join('\\n'));
        el.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (list.length === 1) return go(list[0]);
          choose(el, list);
        });
      });
    });
  }
  var chooser = null;
  function closeChooser() { if (chooser) { chooser.remove(); chooser = null; } }
  function choose(el, list) {
    closeChooser();
    chooser = document.createElement('div'); chooser.className = 'proto-choose';
    var head = document.createElement('div'); head.className = 'hint'; head.textContent = T.chooseFlow || 'Which flow?'; chooser.appendChild(head);
    list.forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (f.style === 'conditional' ? ' proto-cond' : '');
      b.textContent = lineOf(f);
      b.addEventListener('click', function (e) { e.stopPropagation(); closeChooser(); go(f); });
      chooser.appendChild(b);
    });
    var r = el.getBoundingClientRect();
    chooser.style.left = Math.round(r.left) + 'px'; chooser.style.top = Math.round(r.bottom + 4) + 'px';
    document.body.appendChild(chooser);
  }
  document.addEventListener('click', function () { closeChooser(); }, true);
  function show() {
    var t = top(); if (!t) return;
    var bases = stack.filter(function (x) { return !x.overlay; }); var base = bases[bases.length - 1] || t;
    views.forEach(function (v) { v.hidden = true; });
    var bv = viewOf(base.screen, base.state); if (bv) bv.hidden = false;
    overlay.innerHTML = ''; overlay.hidden = true;
    if (t.overlay) {
      var ov = viewOf(t.screen, t.state);
      if (ov) { var c = ov.cloneNode(true); c.hidden = false; overlay.appendChild(c); overlay.hidden = false; arm(c, t.screen); }
    }
    screenSel.value = base.screen;
    stateSel.innerHTML = statesOf(base.screen).map(function (s) { return '<option value="' + s + '"' + (s === base.state ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    var want = t.screen + (t.state !== 'Default' ? '.' + t.state : '');
    if (decodeURIComponent(location.hash.slice(1)) !== want) history.replaceState(null, '', '#' + want);
    // the panel: where the prototype is, and the flows that leave this screen, each a button
    if (panel) {
      var here = flows.filter(function (f) { return f.screen === t.screen; });
      panel.innerHTML = '';
      var h3 = document.createElement('h3'); h3.textContent = t.screen + (t.state !== 'Default' ? ' · ' + t.state : ''); panel.appendChild(h3);
      var help = document.createElement('div'); help.className = 'hint'; help.textContent = T.protoHelp || ''; panel.appendChild(help);
      var title = document.createElement('div'); title.className = 'section-title'; title.textContent = T.flowsFrom || 'Flows'; panel.appendChild(title);
      if (!here.length) { var none = document.createElement('div'); none.className = 'hint'; none.textContent = T.noFlowsFrom || ''; panel.appendChild(none); }
      var box = document.createElement('div'); box.className = 'proto-flows'; panel.appendChild(box);
      here.forEach(function (f) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (f.style === 'conditional' ? ' proto-cond' : '');
        b.textContent = lineOf(f);
        b.addEventListener('click', function () { go(f); });
        box.appendChild(b);
      });
    }
    if (typeof window.doanTreeFollow === 'function') window.doanTreeFollow();
    if (typeof window.doanFit === 'function') window.doanFit();
  }
  function go(f) {
    // dismiss and back leave the current view and land where the flow says — which may be a
    // state the screen underneath was not in (add → kiosk-menu.Selected)
    if (f.nav === 'dismiss' || f.nav === 'back') {
      if (stack.length > 1) stack.pop();
      var under = stack[stack.length - 1] || {};
      stack[Math.max(stack.length - 1, 0)] = { screen: f.to, state: f.state, overlay: !!under.overlay };
      return show();
    }
    var cur = top();
    var entry = { screen: f.to, state: f.state, overlay: f.nav === 'modal' || f.nav === 'sheet' };
    // a flow with no nav that stays on the current screen is a state change: same layer, no new entry
    if (!f.nav && cur && cur.screen === f.to) { entry.overlay = !!cur.overlay; stack.pop(); }
    else if (f.nav === 'replace' && stack.length) stack.pop();
    stack.push(entry);
    show();
  }
  function fromHash() {
    var hsh = decodeURIComponent(location.hash.slice(1)); if (!hsh) return null;
    if (statesOf(hsh).length) return { screen: hsh, state: 'Default' };
    var i = hsh.lastIndexOf('.'); if (i < 1) return null;
    var screen = hsh.slice(0, i), state = hsh.slice(i + 1);
    return viewOf(screen, state) ? { screen: screen, state: state } : null;
  }
  views.forEach(function (v) { arm(v, v.getAttribute('data-screen')); });
  document.body.classList.toggle('show-hotspots', hot.checked);
  hot.addEventListener('change', function () { document.body.classList.toggle('show-hotspots', hot.checked); });
  screenSel.addEventListener('change', function () { stack = [{ screen: screenSel.value, state: 'Default' }]; show(); });
  stateSel.addEventListener('change', function () { var t = top(); if (!t) return; if (t.overlay) stack.pop(); top().state = stateSel.value; show(); });
  back.addEventListener('click', function () { if (stack.length > 1) { stack.pop(); show(); } });
  overlay.addEventListener('click', function (e) { if (e.target === overlay && stack.length > 1) { stack.pop(); show(); } });
  window.addEventListener('hashchange', function () { var t = fromHash(); var c = top(); if (t && (!c || t.screen !== c.screen || t.state !== c.state)) { stack = [t]; show(); } });
  var first = fromHash() || (screenSel.value ? { screen: screenSel.value, state: 'Default' } : null);
  if (first) { stack = [first]; show(); }
})();
`;

// The domain canvas page's own script: zoom and pan, and the arrows — measured off the frames
// and elements on the canvas, drawn by fig's rules. No template literal inside.
export const CANVAS_JS = `
(function () {
  var wrap = document.getElementById('cv-wrap'), canvas = document.getElementById('cv-canvas'), domain = document.getElementById('cv-domain'), svg = document.getElementById('cv-arrows');
  if (!wrap || !canvas || !domain || !svg) return;
  var zoomEl = document.getElementById('cv-zoom');
  var scale = 1, tx = 0, ty = 0;
  function apply() { canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + '%'; }
  function fitAll() {
    var w = domain.offsetWidth || 1, h = domain.offsetHeight || 1, W = wrap.clientWidth, H = wrap.clientHeight;
    scale = Math.max(0.05, Math.min(1, (W - 40) / w, (H - 40) / h));
    tx = Math.round((W - w * scale) / 2); ty = Math.round((H - h * scale) / 2); apply();
  }
  function zoomAt(factor, cx, cy) {
    var next = Math.max(0.05, Math.min(4, scale * factor));
    tx = cx - (cx - tx) * (next / scale); ty = cy - (cy - ty) * (next / scale); scale = next; apply();
  }
  wrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = wrap.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else { tx -= e.deltaX; ty -= e.deltaY; apply(); }
  }, { passive: false });
  var drag = null;
  wrap.addEventListener('mousedown', function (e) { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false }; });
  window.addEventListener('mousemove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; wrap.classList.add('dragging'); }
    if (drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; apply(); }
  });
  window.addEventListener('mouseup', function () {
    if (drag && drag.moved) {
      var swallow = function (e) { e.stopPropagation(); e.preventDefault(); window.removeEventListener('click', swallow, true); };
      window.addEventListener('click', swallow, true);
      setTimeout(function () { window.removeEventListener('click', swallow, true); }, 0);
    }
    wrap.classList.remove('dragging'); drag = null;
  });
  var b;
  if ((b = document.getElementById('cv-in'))) b.addEventListener('click', function () { zoomAt(1.25, wrap.clientWidth / 2, wrap.clientHeight / 2); });
  if ((b = document.getElementById('cv-out'))) b.addEventListener('click', function () { zoomAt(0.8, wrap.clientWidth / 2, wrap.clientHeight / 2); });
  if ((b = document.getElementById('cv-fit'))) b.addEventListener('click', fitAll);
  var showArrows = document.getElementById('cv-show-arrows');
  if (showArrows) showArrows.addEventListener('change', function () { document.body.classList.toggle('cv-no-arrows', !showArrows.checked); });

  // arrows: start at the source Default's right edge, at the trigger element's height when the
  // element is on the frame (fig's element anchor) else the edge midpoint; enter the target
  // state frame's left edge at its midpoint, a gap before the head; a flow that goes back climbs
  // into a corridor above both frames and comes down onto the target's top edge.
  var HEAD_GAP = 12, TRUNK = 120, CORRIDOR = 72;
  var NS = 'http://www.w3.org/2000/svg';
  function rectOf(node) { var r = node.getBoundingClientRect(), c = canvas.getBoundingClientRect(); return { x: (r.left - c.left) / scale, y: (r.top - c.top) / scale, w: r.width / scale, h: r.height / scale }; }
  function mk(tag, attrs, text) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (text !== undefined) n.textContent = text; return n; }
  function pathOf(points) { return points.map(function (p, i) { return (i ? 'L' : 'M') + Math.round(p.x) + ' ' + Math.round(p.y); }).join(' '); }
  function label(text, x, y) {
    var g = mk('g', { 'class': 'cv-label' });
    var w = Math.round(text.length * 11) + 20;
    g.appendChild(mk('rect', { x: Math.round(x - w / 2), y: Math.round(y - 16), width: w, height: 32 }));
    g.appendChild(mk('text', { x: Math.round(x), y: Math.round(y + 7), 'text-anchor': 'middle' }, text));
    return g;
  }
  function draw() {
    while (svg.lastChild && svg.lastChild.tagName !== 'defs') svg.removeChild(svg.lastChild);
    svg.setAttribute('width', domain.offsetWidth); svg.setAttribute('height', domain.offsetHeight);
    var frames = {}, cols = {};
    document.querySelectorAll('.cv-frame').forEach(function (f) {
      var screen = f.getAttribute('data-screen'), k = screen + '|' + f.getAttribute('data-state');
      frames[k] = { el: f, r: rectOf(f) };
      (cols[screen] = cols[screen] || []).push(frames[k]);
    });
    Object.keys(cols).forEach(function (s) {
      var list = cols[s];
      for (var i = 1; i < list.length; i++) { var a = list[i - 1].r, c2 = list[i].r; svg.appendChild(mk('path', { 'class': 'cv-chain', d: pathOf([{ x: a.x + a.w / 2, y: a.y + a.h }, { x: c2.x + c2.w / 2, y: c2.y }]) })); }
    });
    var here = (window.DOAN_CANVAS || {}).screens || [], elsewhere = window.DOAN_SCREEN_DOMAIN || {};
    var backRows = 0;
    (window.DOAN_FLOWS || []).forEach(function (f) {
      if (here.indexOf(f.screen) < 0 || f.to === f.screen) return;
      var src = frames[f.screen + '|Default'] || (cols[f.screen] || [])[0]; if (!src) return;
      var s = src.r, start = { x: s.x + s.w, y: s.y + s.h / 2 };
      var anchor = src.el.querySelector('.el[data-id="' + f.from + '"]');
      if (anchor) { var ar = rectOf(anchor), ay = ar.y + ar.h / 2; if (ay > s.y && ay < s.y + s.h) start.y = ay; }
      var text = [f.from + (f.via ? '.' + f.via : ''), f.gesture, f.nav, f.when].filter(Boolean).join(' \\u00b7 ');
      var cls = 'cv-arrow' + (f.style === 'conditional' ? ' conditional' : '');
      var tgt = frames[f.to + '|' + f.state] || frames[f.to + '|Default'] || (cols[f.to] || [])[0];
      if (!tgt) {
        var other = elsewhere[f.to], g = mk('g', { 'class': 'cv-stub' });
        g.appendChild(mk('path', { 'class': cls, d: pathOf([start, { x: start.x + 80, y: start.y }]), 'marker-end': 'url(#cv-arrow)' }));
        var link = mk('a', { href: other ? 'canvas-' + other.slug + '.html' : f.to + '.html' });
        link.appendChild(mk('text', { x: Math.round(start.x + 92), y: Math.round(start.y + 7) }, '\\u2192 ' + (other ? other.domain + ' / ' : '') + f.to + (f.state !== 'Default' ? '.' + f.state : '') + (text ? '  (' + text + ')' : '')));
        g.appendChild(link); svg.appendChild(g); return;
      }
      var t = tgt.r, points, lab;
      if (t.x >= start.x + TRUNK / 2) {
        var end = { x: t.x - HEAD_GAP, y: t.y + t.h / 2 };
        var kx = Math.min(start.x + TRUNK, (start.x + t.x) / 2);
        points = Math.abs(end.y - start.y) < 1 ? [start, end] : [start, { x: kx, y: start.y }, { x: kx, y: end.y }, end];
        lab = points.length === 2 ? { x: (start.x + end.x) / 2, y: start.y - 26 } : { x: kx, y: (start.y + end.y) / 2 };
      } else {
        // back: out into the trunk, up into a corridor above both frames, over, then down the
        // gap on the target's left — never through the frames stacked above it — and in at
        // the left edge's midpoint
        var cy = Math.min(s.y, t.y) - CORRIDOR - backRows * 40; backRows++;
        var gx = t.x - 60 - backRows * 12;
        var end2 = { x: t.x - HEAD_GAP, y: t.y + t.h / 2 };
        points = [start, { x: start.x + TRUNK, y: start.y }, { x: start.x + TRUNK, y: cy }, { x: gx, y: cy }, { x: gx, y: end2.y }, end2];
        lab = { x: (start.x + TRUNK + gx) / 2, y: cy };
      }
      svg.appendChild(mk('path', { 'class': cls, d: pathOf(points), 'marker-end': 'url(#cv-arrow)' }));
      if (text) svg.appendChild(label(text, lab.x, lab.y));
    });
  }
  // --- the workspace: tree, selection, shortcuts, deep links
  var panel = document.getElementById('inspector'), T = window.DOAN_I18N || {};
  function t(k, d) { return T[k] || d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function frameOf(screen, state) { return document.querySelector('.cv-frame[data-screen="' + screen + '"][data-state="' + state + '"]'); }
  function zoomTo(node, pad) {
    var r = rectOf(node), W = wrap.clientWidth, H = wrap.clientHeight; pad = pad || 80;
    scale = Math.max(0.05, Math.min(1, (W - pad * 2) / r.w, (H - pad * 2) / r.h));
    tx = Math.round(W / 2 - (r.x + r.w / 2) * scale); ty = Math.round(H / 2 - (r.y + r.h / 2) * scale); apply();
  }
  var selectedFrame = null;
  function markFrame(frame) {
    document.querySelectorAll('.cv-frame.selected').forEach(function (f) { f.classList.remove('selected'); });
    document.querySelectorAll('.tree-frame.current').forEach(function (a) { a.classList.remove('current'); });
    selectedFrame = frame;
    if (!frame) return;
    frame.classList.add('selected');
    var link = document.querySelector('.tree-frame[data-screen="' + frame.getAttribute('data-screen') + '"][data-state="' + frame.getAttribute('data-state') + '"]');
    if (link) { link.classList.add('current'); var scr = link.closest('.tree-screen'); if (scr) scr.classList.add('open'); }
    // the prototype mode opens on what is selected here
    var protoTab = document.querySelector('.views a[href^="proto.html"]');
    if (protoTab) protoTab.setAttribute('href', 'proto.html#' + frame.getAttribute('data-screen') + (frame.getAttribute('data-state') !== 'Default' ? '.' + frame.getAttribute('data-state') : ''));
    layersFor(frame);
  }
  function setHash(frame, el) {
    if (!frame) return;
    var want = frame.getAttribute('data-screen') + '.' + frame.getAttribute('data-state') + (el ? '/' + el.getAttribute('data-path') : '');
    if (decodeURIComponent(location.hash.slice(1)) !== want) history.replaceState(null, '', '#' + want);
  }
  function frameInfo(frame) {
    var screen = frame.getAttribute('data-screen'), state = frame.getAttribute('data-state');
    var mine = (window.DOAN_FLOWS || []).filter(function (f) { return f.screen === screen; });
    panel.innerHTML =
      '<h4>' + esc(screen) + '-' + esc(state) + ' <span class="hint">' + esc(frame.getAttribute('data-type') || '') + ' \\u00b7 ' + esc(frame.getAttribute('data-platform') || '') + '</span><span class="close" id="close">\\u00d7</span></h4>' +
      '<p><span class="k">' + t('file', 'file') + '</span> <code>' + esc(frame.getAttribute('data-file') || '') + '</code></p>' +
      '<p><a class="btn" href="' + esc(screen) + '.html#state-' + esc(state) + '">' + t('screen', 'screen') + '</a> <a class="btn" href="proto.html#' + esc(screen) + (state !== 'Default' ? '.' + esc(state) : '') + '">\\u25b6 ' + t('proto', 'Prototype') + '</a></p>' +
      '<h4>' + t('flows', 'Flows') + '</h4>' + (mine.length ? '<ul>' + mine.map(function (f) { return '<li><code>' + esc(f.from) + '</code> \\u2192 ' + esc(f.to) + (f.state !== 'Default' ? '.' + esc(f.state) : '') + (f.label ? ' <span class="hint">' + esc(f.label) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="hint">' + t('none', 'none') + '</div>');
    var close = document.getElementById('close'); if (close) close.addEventListener('click', clearAll);
  }
  function selectFrame(frame, zoom) {
    if (window.doanClearSelection) window.doanClearSelection();
    markFrame(frame); frameInfo(frame); setHash(frame, null);
    if (zoom) zoomTo(frame);
  }
  function clearAll() { markFrame(null); if (window.doanClearSelection) window.doanClearSelection(); history.replaceState(null, '', location.pathname); }
  // the element layers of the selected frame, in document order, indented by nesting
  function layersFor(frame) {
    document.querySelectorAll('.tree-layers').forEach(function (n) { n.innerHTML = ''; });
    var box = document.querySelector('.tree-layers[data-screen="' + frame.getAttribute('data-screen') + '"][data-state="' + frame.getAttribute('data-state') + '"]');
    if (!box) return;
    var html = '';
    frame.querySelectorAll('.el').forEach(function (el) {
      var depth = 0, p = el.parentElement; while (p && p !== frame) { if (p.classList.contains('el')) depth++; p = p.parentElement; }
      html += '<div class="tree-el" data-path="' + esc(el.getAttribute('data-path')) + '" style="padding-left:' + (24 + depth * 12) + 'px"><span class="hint">' + esc(el.getAttribute('data-kind')) + '</span> ' + esc(el.getAttribute('data-id')) + '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.tree-el').forEach(function (row) {
      var el = frame.querySelector('.el[data-path="' + row.getAttribute('data-path') + '"]');
      if (!el) return;
      row.addEventListener('mouseenter', function () { el.classList.add('hover'); });
      row.addEventListener('mouseleave', function () { el.classList.remove('hover'); });
      row.addEventListener('click', function () { if (window.doanSelect) window.doanSelect(el); zoomTo(el, 160); });
    });
  }
  // hover on the canvas: only the innermost element lights up
  var hovered = null;
  wrap.addEventListener('mouseover', function (e) { var el = e.target.closest('.cv-body .el'); if (hovered && hovered !== el) hovered.classList.remove('hover'); hovered = el; if (el) el.classList.add('hover'); });
  wrap.addEventListener('mouseleave', function () { if (hovered) hovered.classList.remove('hover'); hovered = null; });
  // a click on a frame that is not on an element selects the frame
  wrap.addEventListener('click', function (e) {
    if (e.target.closest('.el') || e.target.closest('a')) return;
    var frame = e.target.closest('.cv-frame');
    if (frame) selectFrame(frame, false); else clearAll();
  });
  // an element selected by the inspector: sync the frame, the tree row and the hash
  document.addEventListener('doan:select', function (e) {
    var el = e.detail && e.detail.el; if (!el) return;
    var frame = el.closest('.cv-frame'); if (!frame) return;
    if (selectedFrame !== frame) markFrame(frame);
    document.querySelectorAll('.tree-el.current').forEach(function (r) { r.classList.remove('current'); });
    var row = document.querySelector('.tree-el[data-path="' + el.getAttribute('data-path') + '"]'); if (row) { row.classList.add('current'); row.scrollIntoView({ block: 'nearest' }); }
    setHash(frame, el);
  });
  // the tree: a frame on this canvas is selected in place; a frame elsewhere is a link (the tree
  // itself — folding, search — belongs to every page and lives in the inspector script)
  document.querySelectorAll('.tree-frame').forEach(function (a) {
    a.addEventListener('click', function (e) { var f = frameOf(a.getAttribute('data-screen'), a.getAttribute('data-state')); if (f) { e.preventDefault(); selectFrame(f, true); } });
  });
  document.querySelectorAll('.tree-screen-head > a.name').forEach(function (a) {
    a.addEventListener('click', function (e) { var f = frameOf(a.closest('.tree-screen').getAttribute('data-screen'), 'Default'); if (f) { e.preventDefault(); selectFrame(f, true); } });
  });
  var search = document.getElementById('tree-search');
  // shortcuts: Shift+1 fit, Shift+2 zoom to selection, Shift+0 100%, cmd/ctrl +/- zoom, Esc clear, cmd/ctrl F search
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && search) { e.preventDefault(); search.focus(); search.select(); return; }
    if (typing) return;
    var sel = (window.DOAN_CURRENT_EL && document.contains(window.DOAN_CURRENT_EL) && document.querySelector('.el.selected')) || selectedFrame;
    if (e.shiftKey && e.key === '!') { e.preventDefault(); fitAll(); }
    else if (e.shiftKey && e.key === '@') { e.preventDefault(); if (sel) zoomTo(sel, sel.classList.contains('el') ? 160 : 80); }
    else if (e.shiftKey && e.key === ')') { e.preventDefault(); var W = wrap.clientWidth, H = wrap.clientHeight; if (sel) { var r = rectOf(sel); scale = 1; tx = Math.round(W / 2 - (r.x + r.w / 2)); ty = Math.round(H / 2 - (r.y + r.h / 2)); } else { var cx = (W / 2 - tx) / scale, cy = (H / 2 - ty) / scale; scale = 1; tx = Math.round(W / 2 - cx); ty = Math.round(H / 2 - cy); } apply(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(1.25, wrap.clientWidth / 2, wrap.clientHeight / 2); }
    else if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomAt(0.8, wrap.clientWidth / 2, wrap.clientHeight / 2); }
    else if (e.key === 'Escape') { clearAll(); }
  });
  // deep link: #screen.State or #screen.State/elements.1
  function fromHash() {
    var hsh = decodeURIComponent(location.hash.slice(1)); if (!hsh) return false;
    var slash = hsh.indexOf('/'), head = slash > 0 ? hsh.slice(0, slash) : hsh, path = slash > 0 ? hsh.slice(slash + 1) : null;
    var dot = head.lastIndexOf('.'), screen = dot > 0 ? head.slice(0, dot) : head, state = dot > 0 ? head.slice(dot + 1) : 'Default';
    var frame = frameOf(screen, state) || frameOf(head, 'Default'); if (!frame) return false;
    if (frame.getAttribute('data-screen') === head) { state = 'Default'; }
    selectFrame(frame, true);
    if (path) { var el = frame.querySelector('.el[data-path="' + path + '"]'); if (el && window.doanSelect) { window.doanSelect(el); zoomTo(el, 160); } }
    return true;
  }

  // the inspector script runs after this one; the first selection must wait for it
  function start() {
    if (!fromHash()) fitAll();
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    setTimeout(draw, 300);
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('resize', function () { draw(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
`;
