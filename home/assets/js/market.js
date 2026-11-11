/* 物品行情（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var state = { items: [], selected: '', detail: null, conn: 'connecting' };
  var poller = null;

  function text(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  function displayName(id) {
    var raw = String(id === null || id === undefined ? '' : id);
    var key = raw.indexOf('minecraft:') === 0 ? raw.slice(10) : raw;
    var zh = MCW.itemsZh && Object.prototype.hasOwnProperty.call(MCW.itemsZh, key) ? MCW.itemsZh[key] : '';
    if (zh) return zh;
    return key.replace(/_/g, ' ');
  }

  function normalizeItem(it) {
    if (!it || typeof it !== 'object') return it;
    var out = {};
    for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) out[k] = it[k];
    if (out.change24h === undefined || out.change24h === null) {
      var n = Number(out.changePct);
      if (isFinite(n)) out.change24h = n;
    }
    return out;
  }

  function normalizeMarket(input) {
    if (Array.isArray(input)) return input.map(normalizeItem);
    if (input && typeof input === 'object') {
      if (Array.isArray(input.items)) return input.items.map(normalizeItem);
      return normalizeItem(input);
    }
    return [];
  }

  function paintSource(p) {
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
  }

  function renderList() {
    var body = document.getElementById('market-body');
    if (!body) return;
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">' + (state.conn === 'live' ? '暂无物品' : '暂无数据') + '</td></tr>';
      text('mkt-count', '—');
      return;
    }
    text('mkt-count', String(state.items.length));
    body.innerHTML = state.items.map(function (it) {
      var dir = MCW.dirClass(it.change24h);
      return '<tr data-id="' + MCW.esc(it.id) + '"' + (it.id === state.selected ? ' class="sel"' : '') + '>' +
        '<td class="name">' + MCW.esc(displayName(it.id || it.name)) + '</td>' +
        '<td class="num">' + MCW.price(it.price) + '</td>' +
        '<td class="num ' + dir + '">' + MCW.pct(it.change24h) + '</td>' +
        '<td class="num">' + MCW.fmtInt(it.volume) + '</td>' +
        '<td>' + MCW.chart.spark(it.history) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderDetail() {
    var d = state.detail;
    var chart = document.getElementById('i-chart');
    if (!d) {
      text('i-name', '—'); text('i-price', '—'); text('i-chg', '—');
      text('i-vol', '—'); text('i-buyers', '—'); text('i-sellers', '—'); text('i-id', '—');
      if (chart) chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
      return;
    }
    text('i-name', displayName(d.id || d.name) || '—');
    text('i-price', MCW.price(d.price));
    var chg = document.getElementById('i-chg');
    if (chg) {
      chg.textContent = MCW.pct(d.change24h);
      chg.className = 'chg ' + MCW.dirClass(d.change24h);
    }
    text('i-vol', MCW.fmtInt(d.volume));
    text('i-buyers', MCW.fmtInt(d.buyers));
    text('i-sellers', MCW.fmtInt(d.sellers));
    text('i-id', d.id || '—');
    text('i-updated', d.ts ? '更新 ' + MCW.clock(d.ts) : '');
    if (chart && Array.isArray(d.history) && d.history.length > 1) {
      MCW.chart.line(chart, d.history, { height: 220, label: displayName(d.id || d.name) + ' 价格', fmt: function (v) { return MCW.price(v); } });
    } else if (chart) {
      chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
    }
  }

  function pick(id) {
    state.selected = id;
    state.detail = null;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) { state.detail = state.items[i]; break; }
    }
    renderList();
    renderDetail();
  }

  MCW.market = { normalizeMarket: normalizeMarket, displayName: displayName };

  MCW.ready(function () {
    var body = document.getElementById('market-body');
    if (!body) return;
    body.addEventListener('click', function (ev) {
      var tr = ev.target.closest ? ev.target.closest('tr[data-id]') : null;
      if (tr) pick(tr.getAttribute('data-id'));
    });

    if (!MCW.api.connected()) {
      state.conn = 'down';
      renderList();
      renderDetail();
      paintSource({ state: 'down', lastOk: 0, downSince: Date.now() });
      return;
    }

    poller = MCW.live.make('/api/market', { interval: CFG.pollMs || 5000 });
    poller.on(function (p) {
      state.conn = p.state;
      if (p.data && Array.isArray(p.data.items)) {
        state.items = normalizeMarket(p.data.items);
        if (!state.selected && state.items.length) pick(state.items[0].id);
        else if (state.selected) {
          for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].id === state.selected) { state.detail = state.items[i]; break; }
          }
        }
      }
      renderList();
      renderDetail();
      paintSource(p);
    });
    poller.start();
  });
})();
