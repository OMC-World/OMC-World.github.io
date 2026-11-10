/* OMC World 账号、绑定与订单（零依赖，同源 cookie 会话） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CODE_RE = /^\d{6}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var LINK_TTL = 10 * 60 * 1000;

  var state = {
    connected: false,
    user: null,
    code: '',
    expireAt: 0,
    tickTimer: null,
    watchTimer: null
  };

  function el(id) { return document.getElementById(id); }
  function text(id, v) { var n = el(id); if (n) n.textContent = v; }
  function toggle(id, show) { var n = el(id); if (n) n.classList[show ? 'remove' : 'add']('hidden'); }
  function disabled(id, v) { var n = el(id); if (n) n.disabled = !!v; }
  function msg(id, s, kind) {
    var n = el(id);
    if (!n) return;
    n.textContent = s || '';
    n.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function validCode(code) {
    return CODE_RE.test(String(code === null || code === undefined ? '' : code).trim());
  }

  function emailOk(v) {
    return EMAIL_RE.test(String(v === null || v === undefined ? '' : v).trim());
  }

  function userLabel(u) {
    if (!u) return '—';
    return String(u.email || u.login || '—');
  }

  function bindCommand(code) {
    return '/account link ' + String(code === null || code === undefined ? '' : code).trim();
  }

  function viewState(o) {
    o = o || {};
    if (!o.connected) return 'offline';
    return o.user ? 'user' : 'guest';
  }

  function canLink(s) { return s === 'user'; }

  function direction(side) {
    if (side === 'sell') return '卖出';
    if (side === 'buy') return '买入';
    return '—';
  }

  var STATUS = {
    pending: '挂单中', filled: '已成交', partial: '部分成交',
    cancelled: '已取消', canceled: '已取消', rejected: '已拒绝', expired: '已过期'
  };

  function orderStatus(s) {
    var raw = String(s === null || s === undefined ? '' : s).trim();
    var k = raw.toLowerCase();
    return STATUS[k] || raw || '—';
  }

  function mcLabel(mc) {
    if (!mc) return '未绑定';
    var name = String(mc.name || '').trim();
    var uuid = String(mc.uuid || '').trim();
    if (name && uuid) return name + '（' + uuid + '）';
    return name || uuid || '未绑定';
  }

  function parseExpire(v) {
    var t = typeof v === 'number' ? v : Date.parse(String(v || ''));
    if (!isFinite(t)) return Date.now() + LINK_TTL;
    if (t < 1e12) t *= 1000;
    return t;
  }

  function mmss(sec) {
    var s = Math.max(0, Math.round(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function stopTick() {
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  function stopWatch() {
    if (state.watchTimer) clearInterval(state.watchTimer);
    state.watchTimer = null;
  }

  function stopTimers() { stopTick(); stopWatch(); }

  function tick() {
    if (!state.expireAt) return;
    var left = state.expireAt - Date.now();
    if (left <= 0) {
      text('link-expire', '已过期');
      text('link-status', '绑定码已过期，请重新生成。');
      disabled('link-copy', true);
      state.code = '';
      stopTimers();
      return;
    }
    text('link-expire', '剩余 ' + mmss(left / 1000));
  }

  function startTick() {
    stopTick();
    tick();
    state.tickTimer = setInterval(tick, 1000);
  }

  function startWatch() {
    stopWatch();
    state.watchTimer = setInterval(function () {
      if (!state.user) return;
      MCW.api.get('/api/me').then(function (d) {
        var u = d && d.user;
        if (!u || !u.mc || (!u.mc.uuid && !u.mc.name)) return;
        state.user = u;
        state.code = '';
        state.expireAt = 0;
        stopTimers();
        toggle('link-box', false);
        toggle('link-cmd-row', false);
        text('link-expire', '');
        text('link-status', '已绑定：' + mcLabel(u.mc));
        text('link-start', '重新生成绑定码');
        text('acc-mc', mcLabel(u.mc));
        MCW.toast('Minecraft 已绑定', 'ok');
      }).catch(function () {});
    }, 5000);
  }

  function showLink(d) {
    d = d || {};
    if (MCW.play && typeof MCW.play.setServerAddress === 'function') {
      MCW.play.setServerAddress(d.serverAddress);
    }
    state.code = String(d.code || '').trim();
    state.expireAt = parseExpire(d.expireAt);
    toggle('link-box', true);
    toggle('link-cmd-row', true);
    text('link-code', state.code || '------');
    text('link-cmd', bindCommand(state.code));
    var cp = el('link-copy');
    if (cp) {
      cp.setAttribute('data-copy', state.code);
      cp.disabled = !validCode(state.code);
    }
    text('link-status', '进入服务器后输入下面的命令完成绑定。');
    msg('link-msg', '', '');
    startTick();
    startWatch();
  }

  function paint() {
    if (!el('account-panel')) return;
    var st = viewState(state);
    toggle('acc-offline', st === 'offline');
    toggle('acc-guest', st === 'guest');
    toggle('acc-user', st === 'user');
    text('acc-state', st === 'user' ? '已登录' : (st === 'offline' ? '未连接' : '未登录'));
    ['login-email', 'login-password', 'register-email', 'register-password',
      'register-password2', 'login-btn', 'register-btn'].forEach(function (id) {
      disabled(id, st === 'offline');
    });
    if (state.user) {
      text('acc-name', userLabel(state.user));
      text('acc-mc', mcLabel(state.user.mc));
    }
    var linkable = canLink(st);
    disabled('link-start', !linkable);
    if (!linkable) {
      toggle('link-box', false);
      toggle('link-cmd-row', false);
      text('link-expire', '');
      text('link-status', st === 'offline' ? '服务端未连接，绑定功能暂不可用。' : '登录后可生成绑定码。');
      stopTimers();
    }
    disabled('link-copy', !state.code || Date.now() >= state.expireAt);
    disabled('orders-refresh', st === 'offline');
    if (!state.user) {
      var b = el('orders-body');
      if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' +
        (st === 'offline' ? '服务端未连接' : '登录后查看') + '</td></tr>';
    }
  }

  function authError(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'unauthorized' || c === 'invalid_credentials') return '邮箱或密码不正确';
    if (s === 409 || c === 'user_exists') return '该邮箱已注册';
    if (s === 400 || c === 'bad_request') return '邮箱格式不对或密码少于 8 位';
    if (s === 429 || c === 'rate_limited') return '操作太频繁，请稍后再试';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '请求失败';
  }

  function setBusy(on, id, label) {
    var b = el(id);
    if (!b) return;
    if (on) {
      b.setAttribute('data-label', b.textContent);
      b.textContent = label;
      b.disabled = true;
    } else {
      b.textContent = b.getAttribute('data-label') || b.textContent;
      b.disabled = false;
    }
  }

  function clearPasswords() {
    ['login-password', 'register-password', 'register-password2'].forEach(function (id) {
      var n = el(id);
      if (n) n.value = '';
    });
  }

  function switchTab(name) {
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-auth-tab') === name ? 'true' : 'false');
    });
    toggle('login-form', name === 'login');
    toggle('register-form', name === 'register');
    msg('acc-msg', '', '');
  }

  function renderOrders(items) {
    var b = el('orders-body');
    if (!b) return;
    if (!items || !items.length) {
      b.innerHTML = '<tr><td colspan="4" class="muted">暂无订单</td></tr>';
      return;
    }
    b.innerHTML = items.map(function (it) {
      var qty = it && it.qty !== null && it.qty !== undefined ? it.qty : '—';
      return '<tr><td class="sym">' + MCW.esc(it && it.symbol || '—') + '</td>' +
        '<td>' + MCW.esc(direction(it && it.side)) + '</td>' +
        '<td class="num">' + MCW.esc(String(qty)) + '</td>' +
        '<td>' + MCW.esc(orderStatus(it && it.status)) + '</td></tr>';
    }).join('');
  }

  function loadOrders() {
    if (!el('orders-body')) return;
    if (!state.connected) { renderOrders([]); var b0 = el('orders-body'); if (b0) b0.innerHTML = '<tr><td colspan="4" class="muted">服务端未连接</td></tr>'; return; }
    if (!state.user) { renderOrders([]); return; }
    MCW.api.get('/api/orders/mine').then(function (d) {
      renderOrders((d && d.items) || []);
    }, function (err) {
      if (err && (err.status === 401 || err.status === 404)) renderOrders([]);
      else {
        var b = el('orders-body');
        if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' + MCW.esc((err && err.message) || '加载失败') + '</td></tr>';
      }
    });
  }

  function refreshMe() {
    return MCW.api.get('/api/me').then(function (d) {
      state.connected = true;
      state.user = (d && d.user) || null;
      paint();
      loadOrders();
      return state.user;
    }, function (err) {
      if (err && (err.status === 401 || err.code === 'unauthorized')) {
        state.connected = true;
        state.user = null;
      } else {
        state.connected = false;
        state.user = null;
      }
      paint();
      loadOrders();
      return null;
    });
  }

  function logout() {
    MCW.api.post('/api/logout', {}).then(function () {
      state.user = null;
      state.code = '';
      state.expireAt = 0;
      stopTimers();
      paint();
      loadOrders();
      msg('acc-msg', '已退出登录', 'ok');
    }, function (err) {
      msg('acc-msg', (err && err.message) || '退出失败', 'err');
    });
  }

  function postAuth(kind) {
    var isReg = kind === 'register';
    var uEl = el(isReg ? 'register-email' : 'login-email');
    var pEl = el(isReg ? 'register-password' : 'login-password');
    var u = uEl ? uEl.value.trim() : '';
    var p = pEl ? pEl.value : '';
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    if (!u) { msg('acc-msg', '请输入邮箱', 'err'); return; }
      if (!emailOk(u)) { msg('acc-msg', '邮箱格式不正确', 'err'); return; }
    if (!p) { msg('acc-msg', '请输入密码', 'err'); return; }
    if (isReg) {
      if (p.length < 8) { msg('acc-msg', '密码至少 8 位', 'err'); return; }
      var p2El = el('register-password2');
      if ((p2El ? p2El.value : '') !== p) { msg('acc-msg', '两次输入的密码不一致', 'err'); return; }
    }
    var btnId = isReg ? 'register-btn' : 'login-btn';
    setBusy(true, btnId, isReg ? '注册中…' : '登录中…');
    var first = isReg
      ? MCW.api.post('/api/auth/register', { email: u, password: p }).then(function () {
        return MCW.api.post('/api/auth/login', { email: u, password: p }).then(function () { return null; }, function () { return null; });
      })
      : MCW.api.post('/api/auth/login', { email: u, password: p });
    first.then(function () {
      return MCW.api.get('/api/me').then(function (d) { return (d && d.user) || null; }, function (err) {
        if (err && err.status === 401) return null;
        throw err;
      });
    }).then(function (user) {
      if (!user) {
        if (isReg) switchTab('login');
        msg('acc-msg', isReg ? '注册成功，请登录' : '登录状态异常，请重试', isReg ? 'ok' : 'err');
        return;
      }
      state.connected = true;
      state.user = user;
      paint();
      loadOrders();
      msg('acc-msg', isReg ? '注册成功，已登录' : '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      msg('acc-msg', authError(err), 'err');
    }).then(function () {
      setBusy(false, btnId);
    });
  }

  function startLink() {
    if (!state.user) { msg('link-msg', '请先登录', 'err'); return; }
    var btn = el('link-start');
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    MCW.api.post('/api/link/start', {}).then(function (d) {
      showLink(d || {});
      if (btn) btn.textContent = '重新生成';
    }).catch(function (err) {
      if (err && err.status === 401) { state.user = null; paint(); }
      msg('link-msg', authError(err), 'err');
    }).then(function () {
      if (btn) btn.disabled = !state.user;
    });
  }

  function mount() {
    if (!el('account-panel')) return;
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-auth-tab')); });
    });
    var lf = el('login-form');
    if (lf) lf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('login'); });
    var rf = el('register-form');
    if (rf) rf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('register'); });
    var lo = el('acc-logout');
    if (lo) lo.addEventListener('click', logout);
    var ls = el('link-start');
    if (ls) ls.addEventListener('click', startLink);
    var or = el('orders-refresh');
    if (or) or.addEventListener('click', function () { loadOrders(); });
    var retry = el('acc-retry');
    if (retry) retry.addEventListener('click', function () {
      state.connected = MCW.api.connected();
      paint();
      if (state.connected) refreshMe();
    });
    state.connected = MCW.api.connected();
    paint();
    loadOrders();
    if (state.connected) refreshMe();
  }

  MCW.account = {
    validCode: validCode,
    emailOk: emailOk,
    userLabel: userLabel,
    bindCommand: bindCommand,
    viewState: viewState,
    canLink: canLink,
    direction: direction,
    orderStatus: orderStatus,
    mcLabel: mcLabel,
    mount: mount,
    refresh: refreshMe
  };

  MCW.ready(mount);
})();
