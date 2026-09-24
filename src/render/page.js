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
.side .foot { margin-top: var(--space-md); border-top: 1px solid var(--color-border); padding-top: var(--space-sm); }

/* main */
.main { min-width: 0; padding: 0 var(--space-lg) var(--space-xl); }
.top { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; position: sticky; top: 0; background: var(--color-surface); z-index: 5; }
.top h1 { font-size: 18px; margin: 0; }
.meta, .hint { color: var(--color-muted); font-size: 12px; }
.top .spacer { flex: 1; }
.toggle { font-size: 12px; color: var(--color-muted); display: inline-flex; align-items: center; gap: var(--space-xs); cursor: pointer; white-space: nowrap; padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg); }
.toggle input { margin: 0; }
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

/* elements */
.el { position: relative; }
.dots { position: absolute; top: 2px; right: 2px; display: flex; gap: var(--space-xs); z-index: 3; pointer-events: none; }
.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.dot.cond { background: var(--color-muted); }
.dot.tbd { background: var(--color-tbd-border); }
.dot.cm { background: var(--color-primary); }
.el-card, .el-fieldset { padding: var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); display: flex; flex-direction: column; gap: var(--space-md); }
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
.btn { padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); font: inherit; cursor: default; }
.btn-primary { background: var(--color-primary); color: var(--color-primary-text); border-color: var(--color-primary); }
.btn-soft-primary { color: var(--color-primary); border-color: var(--color-primary); }
.btn-danger { color: var(--color-danger); border-color: var(--color-danger); }
.btn[disabled], .is-disabled > .btn, .is-disabled input { opacity: .45; }
.seg { display: inline-flex; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
.seg span { padding: 4px 10px; } .seg .on { background: var(--color-primary); color: var(--color-primary-text); }
.radio { display: flex; gap: var(--space-md); } .radio label { display: inline-flex; align-items: center; gap: var(--space-xs); }
.dot-r { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--color-border); display: inline-block; } .dot-r.on { border: 4px solid var(--color-primary); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-weight: 500; }
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
.img { background: var(--color-surface); border: 1px solid var(--color-border); display: grid; place-items: center; height: 80px; color: var(--color-muted); }
.nav { display: flex; flex-direction: column; gap: var(--space-xs); min-width: var(--size-sm); } .nav-item { padding: 6px 10px; border-radius: var(--radius-sm); color: var(--color-muted); } .nav-item.on { background: var(--color-surface); color: var(--color-text); }
.chk-line { display: inline-flex; align-items: center; gap: var(--space-xs); } .box { width: 14px; height: 14px; border: 1px solid var(--color-border); border-radius: 3px; display: inline-block; } .box.on { background: var(--color-primary); border-color: var(--color-primary); }
.sw { display: inline-block; width: 28px; height: 16px; border-radius: 8px; background: var(--color-border); vertical-align: middle; } .sw.on { background: var(--color-primary); }
.tag { display: inline-block; padding: 0 6px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 11px; background: var(--color-surface); }
.row { display: flex; gap: var(--space-sm); align-items: center; } .row.end { justify-content: flex-end; }
.el.selected { outline: 2px solid var(--color-primary); outline-offset: 2px; }
body.dev .el::before { content: attr(data-path); position: absolute; top: -8px; left: 0; font-size: 9px; background: var(--color-text); color: var(--color-bg); padding: 0 4px; border-radius: 2px; z-index: 2; pointer-events: none; }

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
  var api = window.DESIGN_CORE_API === true;
  var comments = window.DESIGN_CORE_COMMENTS || [];
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
      stage.style.height = Math.ceil(frame.offsetHeight * s) + 'px';
    });
  }
  window.addEventListener('resize', fit);

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

  // comment dots on elements that have comments
  comments.forEach(function (c) {
    document.querySelectorAll('.el[data-path="' + c.path + '"]').forEach(function (el) {
      var dots = el.querySelector(':scope > .dots'); if (!dots) { dots = document.createElement('span'); dots.className = 'dots'; el.appendChild(dots); }
      if (!dots.querySelector('.cm')) { var d = document.createElement('i'); d.className = 'dot cm'; d.title = c.author + ': ' + c.text; dots.appendChild(d); }
    });
  });

  // drawer inspector: one delegated click
  function openDrawer(el) {
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
    var mine = comments.filter(function (c) { return c.path === path; });
    panel.innerHTML =
      '<h4>' + esc(el.getAttribute('data-id')) + ' <span class="hint">' + esc(el.getAttribute('data-kind')) + '</span><span class="close" id="close">×</span></h4>' +
      '<div class="hint">' + (maps ? 'component: ' + esc(maps) : 'component: bundled default') + '</div>' +
      (conds.length ? '<ul>' + conds.map(function (c) { return '<li class="cond-line">' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      '<table>' + rows + '</table>' +
      '<p class="hint">values shown in the picture are samples unless the file sets them</p>' +
      '<p><span class="k">file</span> <code>' + esc(file) + '</code><br><span class="k">path</span> <code>' + esc(path) + '</code>' + (line ? '<br><span class="k">line</span> <code>' + esc(line) + '</code>' : '') + '</p>' +
      '<p><button class="btn" id="copy">copy path:line</button></p>' +
      '<h4>Comments</h4>' + (mine.length ? '<ul>' + mine.map(function (c) { return '<li><b>' + esc(c.author) + '</b> ' + esc(c.text) + '</li>'; }).join('') + '</ul>' : '<div class="hint">none on this element</div>') +
      (api ? '<textarea id="ctext" rows="3" placeholder="say what should change"></textarea><input id="cwho" placeholder="your name"><button class="btn btn-primary" id="csend">Comment</button> <span class="hint" id="cstate"></span>' : '<div class="hint">open the live viewer (design-core serve) to comment</div>');
    shell.classList.add('drawer-open');
    document.getElementById('close').addEventListener('click', function () { shell.classList.remove('drawer-open'); if (selected) selected.classList.remove('selected'); selected = null; fit(); });
    document.getElementById('copy').addEventListener('click', function () {
      var text = file + (line ? ':' + line : '') + '  ' + path;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      document.getElementById('copy').textContent = 'copied';
    });
    var send = document.getElementById('csend');
    if (send) send.addEventListener('click', function () {
      var text = document.getElementById('ctext').value.trim(); var who = document.getElementById('cwho').value.trim();
      if (!text) return;
      fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screen: window.DESIGN_CORE_SCREEN, path: path, line: Number(line) || null, text: text, author: who || 'anonymous' }) })
        .then(function (r) { return r.ok ? location.reload() : r.json().then(function (j) { document.getElementById('cstate').textContent = j.error; }); });
    });
    fit();
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.el');
    if (!el || e.target.closest('a') || e.target.closest('.drawer') || e.target.closest('.tab[data-state]')) return;
    e.preventDefault();
    openDrawer(el);
  });

  var dev = document.getElementById('dev');
  if (dev) dev.addEventListener('change', function () { document.body.classList.toggle('dev', dev.checked); });

  // proposal page: apply / reject
  var approve = document.getElementById('approve'), reject = document.getElementById('reject');
  function verdict(kind) {
    var by = (document.getElementById('by') || {}).value || '';
    var id = (approve || reject).getAttribute('data-id');
    if (kind === 'apply' && !by.trim()) { document.getElementById('verdict').textContent = 'your name first'; return; }
    fetch('/api/proposals/' + id + '/' + kind, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'apply' ? { by: by } : { reason: by }) })
      .then(function (r) { return r.json(); }).then(function (j) { document.getElementById('verdict').textContent = j.error ? j.error : j.status; if (!j.error) setTimeout(function () { location.href = '/'; }, 600); });
  }
  if (approve) approve.addEventListener('click', function () { verdict('apply'); });
  if (reject) reject.addEventListener('click', function () { verdict('reject'); });

  fit();
})();
`;
