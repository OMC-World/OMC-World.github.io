/* 首页：实时状态、在线人数采样折线、服务器信息（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  /* 公网地址由 /api/link/start 返回；首页没有会话，不主动生成绑定码，默认显示待开通 */
  var VER = CFG.version || '1.21.11';
  var SAMPLES = 'omc_online_samples';
  var MAX_POINTS = 180;
  var samples = load();

  function load() {
    try {
      var a = JSON.parse(sessionStorage.getItem(SAMPLES) || '[]');
      return Array.isArray(a) ? a.slice(-MAX_POINTS) : [];
    } catch (e) { return []; }
  }

  function save() {
    try { sessionStorage.setItem(SAMPLES, JSON.stringify(samples.slice(-MAX_POINTS))); } catch (e) {}
  }

  function text(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function uptime(sec) {
    var s = Number(sec);
    if (!isFinite(s) || s < 0) return '—';
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return d + ' 天 ' + h + ' 小时';
    if (h) return h + ' 小时 ' + m + ' 分';
    return m + ' 分';
  }

  function renderChart() {
    var el = document.getElementById('online-chart');
    if (!el) return;
    if (samples.length < 2) {
      el.innerHTML = '<div class="chart-empty">' + (MCW.api.connected() ? '数据采集中，至少需要两次成功请求' : '暂无数据') + '</div>';
      return;
    }
    MCW.chart.line(el, samples, {
      height: 240,
      label: '在线人数',
      fmt: function (v) { return MCW.fmtInt(v); }
    });
    text('chart-meta', '采样 ' + samples.length + ' 点 · 每 ' + Math.round((CFG.pollMs || 5000) / 1000) + ' 秒');
  }

  function paint(p) {
    var d = p.data || {};
    text('stat-online', d.online !== undefined && d.online !== null ? MCW.fmtInt(d.online) : '—');
    text('stat-max', d.max !== undefined && d.max !== null ? '/ ' + MCW.fmtInt(d.max) : '');
    text('stat-tps', d.tps !== undefined && d.tps !== null ? Number(d.tps).toFixed(1) : '—');
    text('stat-version', d.version || VER);

    var dot = document.getElementById('src-dot');
    if (dot) dot.className = 'dot ' + MCW.live.stateClass(p.state);
    text('src-text', p.state === 'live' ? '数据源已连接' : MCW.live.label(p.state));
    text('src-time', p.lastOk ? '更新 ' + MCW.clock(p.lastOk) : '');

    var note = document.getElementById('offline-note');
    if (note) note.classList.toggle('hidden', p.state === 'live');
    var det = document.getElementById('offline-detail');
    if (det) {
      det.textContent = p.state === 'stale'
        ? '连接中断于 ' + MCW.clock(p.downSince) + '，显示最后一次成功数据，每 5 秒重试。'
        : '等待服务端恢复，页面每 5 秒重试。';
    }

    text('srv-meta', d.motd ? String(d.motd) : '—');
    text('srv-state', d.online !== undefined ? (Number(d.online) > 0 ? '运行中' : '空闲') : '—');
    text('srv-version', d.version || '—');
    text('srv-world', d.world && d.world.name ? d.world.name + (d.world.day !== undefined ? ' · 第 ' + d.world.day + ' 天' : '') : '—');
    text('srv-uptime', uptime(d.uptimeSec));

    var players = Array.isArray(d.players) ? d.players : [];
    var names = players.map(function (x) { return x && x.name ? x.name : ''; }).filter(Boolean);
    text('srv-players', players.length
      ? '在线玩家 ' + players.length + ' 人' + (names.length ? '：' + names.slice(0, 8).join('、') + (names.length > 8 ? ' 等' : '') : '')
      : '当前无玩家在线');

    if (p.state === 'live' && d.online !== undefined && d.online !== null) {
      var last = samples[samples.length - 1];
      var t = p.lastOk || Date.now();
      if (!last || last.p !== Number(d.online) || t - last.t >= 4500) {
        samples.push({ t: t, p: Number(d.online) });
        if (samples.length > MAX_POINTS) samples = samples.slice(-MAX_POINTS);
        save();
      }
      renderChart();
    }
  }

  MCW.ready(function () {
    var addr = document.getElementById('addr');
    var cp = document.getElementById('copy-addr');
    if (addr) addr.textContent = '待开通';
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; cp.textContent = '未开通'; }
    text('addr-version', VER);
    text('stat-version', VER);

    renderChart();

    if (!MCW.api.connected()) {
      paint({ state: 'down', data: null, lastOk: 0, downSince: Date.now() });
      return;
    }

    var poller = MCW.live.make('/api/status', { interval: CFG.pollMs || 5000 });
    poller.on(paint);
    poller.start();
  });
})();