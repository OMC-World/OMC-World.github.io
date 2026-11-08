/* 首页：状态摘要 + 推荐服务器 */
(function () {
  'use strict';
  var MCW = window.MCW;

  function portOf(s) {
    if (s.role === 'login') return 25565;
    if (s.role === 'main') return 25566;
    if (s.role === 'mirror') return 26589 + (Number(s.id) - 1025);
    return 25567 + (Number(s.id) - 3);
  }

  function renderSummary(r) {
    var servers = r.servers || [];
    var online = 0, running = 0, games = 0, tpsSum = 0, tpsN = 0;
    servers.forEach(function (s) {
      online += MCW.onlineCount(s);
      if (s.status === 'online') running += 1;
      if (s.role === 'game') games += 1;
      var tps = Number(s.tps);
      if (isFinite(tps) && tps > 0) { tpsSum += tps; tpsN += 1; }
    });
    var tpsAvg = tpsN ? (tpsSum / tpsN).toFixed(1) : '—';

    var set = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('stat-online', MCW.fmtInt(online));
    set('stat-servers', MCW.fmtInt(running) + ' / ' + MCW.fmtInt(servers.length));
    set('stat-games', MCW.fmtInt(games));
    set('stat-tps', tpsAvg);

    var src = document.getElementById('home-source');
    if (src) {
      var live = r.source === 'live';
      src.className = 'badge ' + (live ? 'badge-ok' : 'badge-warn');
      src.textContent = live ? '实时数据' : '离线演示';
      src.title = live ? '数据来自 GET /api/status' : 'API 不可达，展示内置演示数据';
    }
    var upd = document.getElementById('home-updated');
    if (upd) upd.textContent = '更新于 ' + MCW.timeAgo(r.updatedAt);

    var top = servers.filter(function (s) { return s.status === 'online'; })
      .sort(function (a, b) { return MCW.onlineCount(b) - MCW.onlineCount(a); })
      .slice(0, 3);

    var box = document.getElementById('home-server-list');
    if (!box) return;
    if (!top.length) {
      box.innerHTML = '<div class="empty">暂无在线服务器</div>';
      return;
    }
    box.innerHTML = top.map(function (s) {
      var cur = MCW.onlineCount(s);
      var pct = s.max ? Math.min(100, Math.round(cur / s.max * 100)) : 0;
      return '<a class="card server-card" href="./servers.html" style="text-decoration:none;color:inherit">' +
        '<div class="server-top"><div><div class="server-id">ID #' + MCW.esc(s.id) + ' · 端口 ' + portOf(s) + '</div>' +
        '<h3 class="server-name">' + MCW.esc(s.name || ('服务器 #' + s.id)) + '</h3>' +
        '<div class="server-role">' + MCW.esc(MCW.roleText(s.role)) + '</div></div>' +
        '<span class="badge ' + MCW.statusClass(s.status) + '">' + MCW.statusText(s.status) + '</span></div>' +
        '<div><div class="kv"><span>在线玩家</span><b>' + MCW.fmtInt(cur) + ' / ' + MCW.fmtInt(s.max || 0) + '</b></div>' +
        '<div class="meter' + (pct >= 95 ? ' full' : (pct >= 75 ? ' warn' : '')) + '"><span style="width:' + pct + '%"></span></div></div>' +
        '<div class="kv"><span>TPS</span><b>' + (Number(s.tps) > 0 ? Number(s.tps).toFixed(1) : '—') + '</b></div>' +
        '<div class="kv"><span>延迟</span><b>' + (Number(s.latency) > 0 ? Number(s.latency) + ' ms' : '—') + '</b></div>' +
        '</a>';
    }).join('');
  }

  MCW.ready(function () {
    var hostEl = document.getElementById('hero-host');
    if (hostEl) {
      hostEl.textContent = (window.MCWORLD_HOST || 'play.mc-world.example') + ':' + (window.MCWORLD_PORT || 25565);
    }
    var ipBtn = document.getElementById('copy-ip');
    if (ipBtn) {
      ipBtn.setAttribute('data-copy', (window.MCWORLD_HOST || 'play.mc-world.example') + ':' + (window.MCWORLD_PORT || 25565));
    }
    MCW.api.getStatus().then(renderSummary).catch(function () {
      renderSummary({ ok: false, mode: 'offline', source: 'mock', servers: MCW.mock.status().servers, updatedAt: new Date().toISOString() });
    });
  });
})();
