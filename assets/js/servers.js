/* 服务器列表页：实时状态 + 过滤 + 自动刷新 + 离线降级 */
(function () {
  'use strict';
  var MCW = window.MCW;
  var filter = 'all';
  var cache = [];
  var timer = null;

  function portOf(s) {
    if (s.role === 'login') return 25565;
    if (s.role === 'main') return 25566;
    if (s.role === 'mirror') return 26589 + (Number(s.id) - 1025);
    return 25567 + (Number(s.id) - 3);
  }

  function card(s) {
    var cur = MCW.onlineCount(s);
    var pct = s.max ? Math.min(100, Math.round(cur / s.max * 100)) : 0;
    var tps = Number(s.tps);
    var lat = Number(s.latency);
    var port = portOf(s);
    return '<article class="card server-card" data-role="' + MCW.esc(s.role) + '">' +
      '<div class="server-top"><div>' +
      '<div class="server-id">ID #' + MCW.esc(s.id) + ' · 内部端口 ' + port + '</div>' +
      '<h3 class="server-name">' + MCW.esc(s.name || ('服务器 #' + s.id)) + '</h3>' +
      '<div class="server-role">' + MCW.esc(MCW.roleText(s.role)) + '</div>' +
      '</div><span class="badge ' + MCW.statusClass(s.status) + '">' + MCW.statusText(s.status) + '</span></div>' +
      '<div><div class="kv"><span>在线玩家</span><b>' + MCW.fmtInt(cur) + ' / ' + MCW.fmtInt(s.max || 0) + '</b></div>' +
      '<div class="meter' + MCW.tpsClass(tps) + '"><span style="width:' + pct + '%"></span></div></div>' +
      '<div class="kv"><span>TPS</span><b>' + (tps > 0 ? tps.toFixed(1) : '—') + '</b></div>' +
      '<div class="kv"><span>延迟</span><b>' + (lat > 0 ? lat + ' ms' : '—') + '</b></div>' +
      '<div class="server-foot"><span>' + (s.role === 'login' ? '对外入口 ' + (window.MCWORLD_HOST || 'play.mc-world.example') + ':25565' : '经代理转发，勿直连') + '</span>' +
      '<button class="btn btn-sm" type="button" data-copy="' + MCW.esc((window.MCWORLD_HOST || 'play.mc-world.example') + ':25565') + '">复制入口</button></div>' +
      '</article>';
  }

  function render(r) {
    cache = r.servers || [];
    var shown = filter === 'all' ? cache : cache.filter(function (s) { return s.role === filter; });
    var grid = document.getElementById('server-grid');
    if (grid) {
      grid.innerHTML = shown.length ? shown.map(card).join('') : '<div class="empty">该分类下暂无服务器</div>';
    }
    var total = 0;
    cache.forEach(function (s) { total += MCW.onlineCount(s); });
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('status-total', MCW.fmtInt(total));
    set('status-count', MCW.fmtInt(cache.length));
    set('status-updated', MCW.fmtTime(r.updatedAt));

    var src = document.getElementById('status-source');
    if (src) {
      var live = r.source === 'live';
      src.className = 'badge ' + (live ? 'badge-ok' : 'badge-warn');
      src.textContent = live ? '实时数据' : (r.mode === 'demo' ? '演示数据' : '离线数据');
    }
    var banner = document.getElementById('offline-banner');
    if (banner) {
      banner.classList.toggle('hidden', r.source === 'live');
      var txt = document.getElementById('offline-text');
      if (txt) {
        txt.innerHTML = r.mode === 'demo'
          ? '当前未配置 API 地址（<code>config.js</code> 中的 <code>window.MCWORLD_API</code> 仍为占位符），页面使用<b>内置演示数据</b>渲染。配置后自动切换为实时状态。'
          : '无法连接 <code>GET /api/status</code>（' + MCW.esc(r.error || '网络不可达') + '），页面已切换为<b>离线演示数据</b>，不影响浏览。';
      }
    }
  }

  function load() {
    var btn = document.getElementById('refresh-btn');
    if (btn) { btn.disabled = true; btn.textContent = '刷新中…'; }
    MCW.api.getStatus().then(function (r) {
      render(r);
      if (btn) { btn.disabled = false; btn.textContent = '刷新状态'; }
    }).catch(function () {
      render({ ok: false, mode: 'offline', source: 'mock', servers: MCW.mock.status().servers, updatedAt: new Date().toISOString(), error: '网络不可达' });
      if (btn) { btn.disabled = false; btn.textContent = '刷新状态'; }
    });
  }

  function loadList() {
    MCW.api.getServers().then(function (r) {
      var tbody = document.getElementById('server-table-body');
      if (!tbody) return;
      tbody.innerHTML = (r.servers || []).map(function (s) {
        return '<tr><td><code>#' + MCW.esc(s.id) + '</code></td>' +
          '<td>' + MCW.esc(MCW.roleText(s.role)) + '</td>' +
          '<td class="mono">' + MCW.esc(s.port) + '</td>' +
          '<td class="mono">' + MCW.esc(s.host) + '</td>' +
          '<td>' + MCW.esc(s.name) + '</td>' +
          '<td class="dim">' + MCW.esc(s.desc || '') + '</td></tr>';
      }).join('');
    });
  }

  MCW.ready(function () {
    MCW.qsa('.chip[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filter = btn.getAttribute('data-filter');
        MCW.qsa('.chip[data-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); });
        render({ servers: cache, source: document.getElementById('status-source') && document.getElementById('status-source').textContent === '实时数据' ? 'live' : 'mock', updatedAt: new Date().toISOString() });
      });
    });
    var refresh = document.getElementById('refresh-btn');
    if (refresh) refresh.addEventListener('click', function () { load(); loadList(); });
    load();
    loadList();
    timer = setInterval(function () {
      if (document.hidden) return;
      load();
    }, 30000);
    window.addEventListener('pagehide', function () { if (timer) clearInterval(timer); });
  });
})();
