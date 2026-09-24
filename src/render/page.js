// Page chrome: the CSS every rendered page carries and the one delegated click handler
// behind the inspector. Sizes and colours come from tokens (tokens.js); nothing here
// hard-codes a value a team would want to change.
export const CSS = `
:root { --size-sm: 240px; --size-md: 480px; --size-lg: 720px; --size-full: 100%; }
* { box-sizing: border-box; }
body { margin: 0; font: var(--font-size)/1.45 var(--font-family); color: var(--color-text); background: var(--color-surface); padding-right: 340px; }
a { color: var(--color-primary); }
.top { display: flex; align-items: baseline; gap: var(--space-md); padding: var(--space-md) var(--space-lg); background: var(--color-bg); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; z-index: 5; }
.top h1 { font-size: 18px; margin: 0; }
.meta, .hint { color: var(--color-muted); font-size: 12px; }
.dev-toggle { margin-left: auto; font-size: 12px; color: var(--color-muted); }
.refs { padding: var(--space-sm) var(--space-lg); font-size: 12px; color: var(--color-muted); }
.ref { margin-right: var(--space-md); }
.row-title { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--color-muted); margin: var(--space-lg) var(--space-lg) var(--space-sm); }
.states { display: flex; gap: var(--space-lg); padding: 0 var(--space-lg); overflow-x: auto; align-items: flex-start; }
.state { flex: 0 0 var(--size-lg); max-width: var(--size-lg); }
.state h3 { font-size: 12px; margin: 0 0 var(--space-xs); color: var(--color-muted); }
.view-root { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); min-height: 120px; }
.backdrop { background: rgba(31,35,40,.45); padding: var(--space-xl); border-radius: var(--radius-md); display: flex; justify-content: center; }
.backdrop .modal-box { width: var(--size-md); }
.backdrop .view-root { border: 0; box-shadow: 0 8px 32px rgba(0,0,0,.25); padding: var(--space-lg); }
.el { position: relative; }
.el-card, .el-fieldset, .el-section { padding: var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); display: flex; flex-direction: column; gap: var(--space-md); }
.el-section { border: 0; padding: 0; }
.card-title, .section-title, .modal-title { font-weight: 600; }
.modal-body { display: flex; flex-direction: column; gap: var(--space-md); }
.el-page-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); }
.el-page-header h2 { font-size: 16px; margin: 0; }
.ph-actions { display: flex; gap: var(--space-sm); }
.tabs { display: flex; gap: var(--space-md); margin-top: var(--space-xs); }
.tab { padding-bottom: 2px; color: var(--color-muted); } .tab.active { color: var(--color-text); border-bottom: 2px solid var(--color-primary); }
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
.dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--color-border); display: inline-block; } .dot.on { border: 4px solid var(--color-primary); }
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
.cond { display: inline-block; font-size: 10px; color: var(--color-muted); border: 1px dashed var(--color-border); border-radius: var(--radius-sm); padding: 0 4px; margin-bottom: 2px; }
.el-unknown { border: 1px dashed var(--color-border); padding: var(--space-sm); border-radius: var(--radius-sm); }
.generic-head { font-size: 11px; color: var(--color-muted); text-transform: uppercase; }
.prop { display: flex; gap: var(--space-sm); font-size: 12px; } .prop .k { color: var(--color-muted); min-width: 80px; }
.stats { display: flex; gap: var(--space-lg); } .stat-v { font-size: 20px; font-weight: 600; } .stat-l { font-size: 11px; color: var(--color-muted); }
.tiles { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: var(--space-xs); }
.tile { aspect-ratio: 1; border-radius: 2px; background: var(--color-border); } .t1 { background: #9bd1a5; } .t2 { background: #5aa86b; } .t3 { background: #e0b64a; } .t4 { background: #d1434b; }
.sortable { display: flex; flex-direction: column; gap: var(--space-xs); } .sort-item { padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.img { background: var(--color-surface); border: 1px solid var(--color-border); display: grid; place-items: center; height: 80px; color: var(--color-muted); }
.nav { display: flex; flex-direction: column; gap: var(--space-xs); min-width: var(--size-sm); } .nav-item { padding: 6px 10px; border-radius: var(--radius-sm); color: var(--color-muted); } .nav-item.on { background: var(--color-surface); color: var(--color-text); }
.chk-line { display: inline-flex; align-items: center; gap: var(--space-xs); } .box { width: 14px; height: 14px; border: 1px solid var(--color-border); border-radius: 3px; display: inline-block; } .box.on { background: var(--color-primary); border-color: var(--color-primary); }
.sw { display: inline-block; width: 28px; height: 16px; border-radius: 8px; background: var(--color-border); vertical-align: middle; } .sw.on { background: var(--color-primary); }
.tag { display: inline-block; padding: 0 6px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 11px; background: var(--color-surface); }
.row { display: flex; gap: var(--space-sm); align-items: center; } .row.end { justify-content: flex-end; }
.flows, .notes { margin: 0 var(--space-lg) var(--space-lg); padding-left: var(--space-lg); }
.dead { color: var(--color-danger); text-decoration: line-through; }
.inspector { position: fixed; top: 0; right: 0; width: 320px; height: 100vh; overflow: auto; background: var(--color-bg); border-left: 1px solid var(--color-border); padding: var(--space-md); font-size: 12px; z-index: 6; }
.inspector h4 { margin: 0 0 var(--space-xs); font-size: 13px; }
.inspector table { font-size: 12px; } .inspector th { width: 34%; }
.inspector code { background: var(--color-surface); padding: 1px 4px; border-radius: 3px; }
.el.selected { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cbadge { position: absolute; top: -6px; right: -6px; font-size: 12px; z-index: 3; }
.inspector textarea, .inspector input { width: 100%; margin: 4px 0; }
body.dev .el::before { content: attr(data-path); position: absolute; top: -8px; left: 0; font-size: 9px; background: var(--color-text); color: var(--color-bg); padding: 0 4px; border-radius: 2px; z-index: 2; pointer-events: none; }
.index { margin: var(--space-lg); width: auto; min-width: 640px; background: var(--color-bg); } .bad { color: var(--color-danger); font-weight: 600; }
`;

export const INSPECTOR_JS = `
(function () {
  var panel = document.getElementById('inspector');
  var file = document.body.getAttribute('data-file') || '';
  var selected = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.el');
    if (!el || e.target.closest('a')) return;
    e.preventDefault();
    if (selected) selected.classList.remove('selected');
    selected = el; el.classList.add('selected');
    var props = {}; try { props = JSON.parse(el.getAttribute('data-props') || '{}'); } catch (_) {}
    var rows = Object.keys(props).filter(function (k) { return k !== 'id' && k !== 'kind'; }).map(function (k) {
      return '<tr><th>' + esc(k) + '</th><td>' + esc(typeof props[k] === 'object' ? JSON.stringify(props[k]) : props[k]) + '</td></tr>';
    }).join('');
    var path = el.getAttribute('data-path'), line = el.getAttribute('data-line'), maps = el.getAttribute('data-maps');
    panel.innerHTML =
      '<h4>' + esc(el.getAttribute('data-id')) + ' <span class="hint">' + esc(el.getAttribute('data-kind')) + '</span></h4>' +
      (maps ? '<div class="hint">component: ' + esc(maps) + '</div>' : '<div class="hint">component: bundled default</div>') +
      '<table>' + rows + '</table>' +
      '<p><b>file</b> <code>' + esc(file) + '</code><br><b>path</b> <code>' + esc(path) + '</code>' + (line ? '<br><b>line</b> <code>' + esc(line) + '</code>' : '') + '</p>' +
      '<p><button class="btn" id="copy">copy path:line</button></p>';
    var copy = document.getElementById('copy');
    copy.addEventListener('click', function () {
      var text = file + (line ? ':' + line : '') + '  ' + path;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      copy.textContent = 'copied';
    });
  });
  var dev = document.getElementById('dev');
  if (dev) dev.addEventListener('change', function () { document.body.classList.toggle('dev', dev.checked); });

  // Live viewer only (served by "design-core serve"): comments and approvals go to the API.
  var api = window.DESIGN_CORE_API === true;
  var comments = window.DESIGN_CORE_COMMENTS || [];
  comments.forEach(function (c) {
    var el = document.querySelector('.el[data-path="' + c.path + '"]');
    if (el) { var b = document.createElement('span'); b.className = 'cbadge'; b.textContent = '💬'; b.title = c.author + ': ' + c.text; el.appendChild(b); }
  });
  if (api) {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('.el');
      if (!el || e.target.closest('a') || !panel) return;
      var mine = comments.filter(function (c) { return c.path === el.getAttribute('data-path'); });
      var box = document.createElement('div');
      box.innerHTML = '<h4>Comments</h4>' + (mine.length ? '<ul>' + mine.map(function (c) { return '<li><b>' + esc(c.author) + '</b> ' + esc(c.text) + '</li>'; }).join('') + '</ul>' : '<div class="hint">none on this element</div>') +
        '<textarea id="ctext" rows="3" placeholder="say what should change"></textarea><input id="cwho" placeholder="your name"><button class="btn btn-primary" id="csend">Comment</button><span class="hint" id="cstate"></span>';
      panel.appendChild(box);
      document.getElementById('csend').addEventListener('click', function () {
        var text = document.getElementById('ctext').value.trim(); var who = document.getElementById('cwho').value.trim();
        if (!text) return;
        fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screen: window.DESIGN_CORE_SCREEN, path: el.getAttribute('data-path'), line: Number(el.getAttribute('data-line')) || null, text: text, author: who || 'anonymous' }) })
          .then(function (r) { return r.ok ? location.reload() : r.json().then(function (j) { document.getElementById('cstate').textContent = j.error; }); });
      });
    });
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
  }
})();
`;
