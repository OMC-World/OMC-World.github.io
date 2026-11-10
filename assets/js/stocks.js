/* 股票行情、详情与下单（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var state = { list: [], selected: '', detail: null, side: 'buy', listState: 'connecting', detailState: 'connecting', busy: false };
  var listPoller = null, detailPoller = null;

  function text(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function setDisabled(id, off) { var el = document.getElementById(id); if (el) el.disabled = !!off; }

  function estimate(price, qty) {
    var p = Number(price), q = Number(qty);
    if (!isFinite(p) || !isFinite(q) || p <= 0 || q <= 0) return null;
    return Math.round(p * q * 100) / 100;
  }

  function validate(input) {
    input = input || {};
    if (input.side !== 'buy' && input.side !== 'sell') return { ok: false, msg: '请选择买入或卖出' };
    var q = Number(input.qty);
    if (!isFinite(q) || q <= 0 || Math.floor(q) !== q) return { ok: false, msg: '数量必须是正整数' };
    if (!String(input.linkCode || '').trim()) return { ok: false, msg: '请填写游戏内绑定码' };
    var total = estimate(input.price, q);
    if (total === null) return { ok: false, msg: '暂无参考价' };
    return { ok: true, total: total };
  }

  function tradeEnabled(connState, detail) {
    return connState === 'live' && !!detail && Number(detail.price) > 0;
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
    updateOrderState();
  }

  function renderList() {
    var body = document.getElementById('stock-body');
    if (!body) return;
    if (!state.list.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted">' + (state.listState === 'live' ? '暂无股票' : '暂无数据') + '</td></tr>';
      text('mkt-count', '—');
      return;
    }
    text('mkt-count', String(state.list.length));
    body.innerHTML = state.list.map(function (s) {
      var dir = MCW.dirClass(s.change24h);
      return '<tr data-symbol="' + MCW.esc(s.symbol) + '"' + (s.symbol === state.selected ? ' class="sel"' : '') + '>' +
        '<td class="sym">' + MCW.esc(s.symbol) + '</td>' +
        '<td class="name">' + MCW.esc(s.name || '') + '</td>' +
        '<td class="num">' + MCW.price(s.price) + '</td>' +
        '<td class="num ' + dir + '">' + MCW.pct(s.change24h) + '</td>' +
        '<td class="num">' + MCW.fmtInt(s.volume) + '</td>' +
        '<td>' + MCW.chart.spark(s.history) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderDetail() {
    var d = state.detail;
    var chart = document.getElementById('d-chart');
    if (!d) {
      text('d-sym', '—'); text('d-price', '—'); text('d-chg', '—'); text('d-name', '—');
      text('d-vol', '—'); text('d-cap', '—'); text('d-holders', '—'); text('d-sector', '—');
      if (chart) chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
      updateOrderState();
      return;
    }
    text('d-sym', d.symbol || '—');
    text('d-price', MCW.price(d.price));
    var chg = document.getElementById('d-chg');
    if (chg) {
      chg.textContent = MCW.pct(d.change24h);
      chg.className = 'chg ' + MCW.dirClass(d.change24h);
    }
    text('d-name', (d.name || '') + (d.sector ? ' · ' + d.sector : ''));
    text('d-vol', MCW.fmtInt(d.volume));
    text('d-cap', MCW.fmtInt(d.marketCap));
    text('d-holders', MCW.fmtInt(d.holders));
    text('d-sector', d.sector || '—');
    text('d-updated', d.ts ? '更新 ' + MCW.clock(d.ts) : '');
    if (chart && Array.isArray(d.history) && d.history.length > 1) {
      MCW.chart.line(chart, d.history, { height: 220, label: d.symbol + ' 价格', fmt: function (v) { return MCW.price(v); }, volume: true });
    } else if (chart) {
      chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
    }
    updateOrderState();
  }

  function updateOrderState() {
    var d = state.detail;
    var price = d ? d.price : null;
    text('o-price', price !== undefined && price !== null ? MCW.price(price) : '—');
    var qty = Number((document.getElementById('o-qty') || {}).value || 0);
    var total = estimate(price, qty);
    text('o-total', total === null ? '—' : MCW.price(total));
    var btn = document.getElementById('o-submit');
    var can = tradeEnabled(state.detailState, d);
    if (btn) {
      btn.disabled = !can;
      btn.textContent = state.side === 'buy' ? '买入' : '卖出';
      btn.title = can ? '' : '服务端未连接';
    }
    text('o-meta', state.detailState === 'live' ? '可下单' : MCW.live.label(state.detailState));
    var q = document.getElementById('o-qty');
    if (q && q.value !== '' && Number(q.value) < 1) q.value = '1';
  }

  /* 列表接口当前返回 {items:[...]}；旧契约/测试桩用 {stocks:[...]}，两种都认，其他返回 null */
  function normalizeList(d) {
    if (!d) return null;
    if (Array.isArray(d.stocks)) return d.stocks;
    if (Array.isArray(d.items)) return d.items;
    return null;
  }

  /* 详情接口有两种形状：
     {symbol, quote:{...}, history:[{ts,price}]}（当前 Worker）
     或直接一只股票的扁平对象（兼容旧契约） */
  function normalizeDetail(d) {
    if (!d) return null;
    var base = d.quote || d.stock || d.item || (d.price !== undefined ? d : null);
    if (!base) return null;
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if (!out.symbol) out.symbol = d.symbol || '';
    var hist = Array.isArray(d.history) ? d.history : (Array.isArray(base.history) ? base.history : null);
    if (hist) out.history = hist;
    if (d.ts && !out.ts) out.ts = d.ts;
    return out;
  }

  function select(symbol) {
    if (!symbol || symbol === state.selected) return;
    state.selected = symbol;
    state.detail = null;
    renderList();
    renderDetail();
    if (detailPoller) detailPoller.stop();
    if (!MCW.api.connected()) return;
    detailPoller = MCW.live.make('/api/stocks/' + encodeURIComponent(symbol), { interval: CFG.pollMs || 5000 });
    detailPoller.on(function (p) {
      state.detailState = p.state;
      if (p.data) state.detail = normalizeDetail(p.data);
      renderDetail();
      paintSource(p);
    });
    detailPoller.start();
  }

  function submit() {
    if (state.busy) return;
    var qty = Number((document.getElementById('o-qty') || {}).value);
    var link = String((document.getElementById('o-link') || {}).value || '').trim();
    var check = validate({ side: state.side, qty: qty, linkCode: link, price: state.detail && state.detail.price });
    var msg = document.getElementById('o-msg');
    if (!check.ok) {
      if (msg) { msg.textContent = check.msg; msg.className = 'msg err'; }
      return;
    }
    if (!state.selected) return;
    state.busy = true;
    setDisabled('o-submit', true);
    if (msg) { msg.textContent = '提交中…'; msg.className = 'msg'; }
    MCW.api.trade({ symbol: state.selected, side: state.side, qty: qty, linkCode: link }).then(function (r) {
      state.busy = false;
      if (msg) {
        msg.textContent = '成交 ' + MCW.fmtInt(r.filled) + ' 股，均价 ' + MCW.price(r.price) + '，金额 ' + MCW.price(r.total) + '，余额 ' + MCW.price(r.balance);
        msg.className = 'msg ok';
      }
      text('o-balance', MCW.price(r.balance));
      updateOrderState();
      if (detailPoller) detailPoller.tick();
      if (listPoller) listPoller.tick();
    }, function (err) {
      state.busy = false;
      if (msg) { msg.textContent = (err && err.message) || '下单失败'; msg.className = 'msg err'; }
      updateOrderState();
    });
  }

  MCW.stocks = {
    estimate: estimate,
    validate: validate,
    tradeEnabled: tradeEnabled,
    normalizeList: normalizeList,
    normalizeDetail: normalizeDetail,
    state: state
  };

  MCW.ready(function () {
    if (!document.getElementById('stock-body')) return;
    MCW.qsa('[data-side]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.side = b.getAttribute('data-side');
        MCW.qsa('[data-side]').forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        updateOrderState();
      });
    });
    var qty = document.getElementById('o-qty');
    if (qty) qty.addEventListener('input', updateOrderState);
    var btn = document.getElementById('o-submit');
    if (btn) btn.addEventListener('click', submit);
    var body = document.getElementById('stock-body');
    if (body) body.addEventListener('click', function (ev) {
      var tr = ev.target.closest ? ev.target.closest('tr[data-symbol]') : null;
      if (tr) select(tr.getAttribute('data-symbol'));
    });

    if (!MCW.api.connected()) {
      state.listState = 'down';
      state.detailState = 'down';
      renderList();
      renderDetail();
      paintSource({ state: 'down', lastOk: 0, downSince: Date.now() });
      return;
    }

    listPoller = MCW.live.make('/api/stocks', { interval: CFG.pollMs || 5000 });
    listPoller.on(function (p) {
      state.listState = p.state;
      var list = normalizeList(p.data);
      if (list) {
        state.list = list;
        if (!state.selected && state.list.length) select(state.list[0].symbol);
      }
      renderList();
      paintSource(p);
    });
    listPoller.start();
  });
})();