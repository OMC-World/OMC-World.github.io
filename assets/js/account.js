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
    watchTimer: null,
    tfa: {
      phase: 'idle',
      challengeId: '',
      secret: '',
      otpauthUrl: '',
      codes: [],
      rendered: false
    }
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

  function bool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      var s = v.toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled';
    }
    return false;
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

  function userKey(u) {
    if (!u) return '';
    return String(u.id || u.email || u.login || '');
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
        var u = normalizeMe(d);
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
        paintTfa();
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

  function twoFactorOn(u) {
    if (!u) return false;
    if (u.twoFactor !== undefined) return bool(u.twoFactor);
    if (u.two_factor !== undefined) return bool(u.two_factor);
    if (u.twofa && u.twofa.enabled !== undefined) return bool(u.twofa.enabled);
    return false;
  }

  function normalizeMe(d) {
    var u = d && d.user ? Object.assign({}, d.user) : null;
    if (!u) return null;
    if (d && d.twoFactor !== undefined) u.twoFactor = bool(d.twoFactor);
    else if (u.twoFactor === undefined && u.twofa && u.twofa.enabled !== undefined) u.twoFactor = bool(u.twofa.enabled);
    else if (u.twoFactor === undefined && u.two_factor !== undefined) u.twoFactor = bool(u.two_factor);
    return u;
  }

  function isTwoFactorRequired(d) {
    return !!(d && (bool(d.twoFactorRequired) || bool(d.two_factor_required) ||
      bool(d.need2fa) || bool(d.requires2fa) || bool(d.challengeRequired)));
  }

  function challengeIdOf(d) {
    if (!d) return '';
    return String(d.challengeId || d.challenge_id || d.challenge || '').trim();
  }

  function recoveryCodesOf(d) {
    var list = d && (d.recoveryCodes || d.recovery_codes || d.codes);
    if (!Array.isArray(list)) return [];
    return list.map(function (c) { return String(c === null || c === undefined ? '' : c).trim(); })
      .filter(function (c) { return !!c; });
  }

  function recoveryLeft(u) {
    var n = u && u.recoveryCodesLeft;
    if (typeof n === 'string' && n.trim() !== '') n = Number(n);
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  function tfaErrorMessage(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'invalid_code' || c === 'invalid_2fa' || c === 'invalid_credentials') {
      return '验证码或密码不正确';
    }
    if (s === 400 || c === 'bad_request' || c === 'invalid_request') {
      return '验证码格式不正确，请输入 6 位验证码或恢复码';
    }
    if (c === 'already_enabled') return '两步验证已开启，请先关闭';
    if (c === 'not_enabled') return '两步验证当前未开启';
    if (s === 429 || c === 'rate_limited') return '尝试太频繁，请稍后再试';
    if (c === 'challenge_missing' || c === 'challenge_expired') return '验证会话已失效，请重新登录';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '验证失败，请重试';
  }

  function loginRequest(email, password) {
    return MCW.api.post('/api/auth/login', { email: email, password: password }).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/login', { email: email, password: password });
      }
      throw err;
    });
  }

  function verifyRequest(challengeId, code) {
    return MCW.api.post('/api/login/2fa', { challengeId: challengeId, code: code }).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/auth/2fa/verify', { challengeId: challengeId, code: code });
      }
      throw err;
    });
  }

  function resetTfaState(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.secret = '';
    state.tfa.otpauthUrl = '';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    var sc = el('tfa-copy-secret');
    if (sc) { sc.setAttribute('data-copy', ''); sc.disabled = true; }
    var su = el('tfa-copy-uri');
    if (su) { su.setAttribute('data-copy', ''); su.disabled = true; }
    text('tfa-secret', '—');
    text('tfa-otpauth', '—');
    var ec = el('tfa-enable-code');
    if (ec) ec.value = '';
    var di = el('tfa-disable-input');
    if (di) di.value = '';
    if (clearMsg !== false) msg('tfa-msg', '', '');
    paintTfa();
  }

  function paintLoginMode() {
    var challenge = state.tfa.phase === 'login';
    toggle('auth-tabs', !challenge);
    toggle('login-2fa-form', challenge);
    if (challenge) {
      toggle('login-form', false);
      toggle('register-form', false);
    }
    disabled('login-2fa-code', !state.connected);
    disabled('login-2fa-btn', !state.connected);
  }

  function showLoginChallenge(d) {
    state.tfa.phase = 'login';
    state.tfa.challengeId = challengeIdOf(d);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    paintLoginMode();
    msg('acc-msg', state.tfa.challengeId
      ? '该账号已开启两步验证，请输入 6 位验证码或恢复码。'
      : '服务端未返回验证会话，请重新登录。', state.tfa.challengeId ? 'ok' : 'err');
    if (c && c.focus && state.tfa.challengeId) {
      try { c.focus(); } catch (e) {}
    }
  }

  function resetLoginChallenge(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.challengeId = '';
    toggle('login-2fa-form', false);
    toggle('auth-tabs', true);
    toggle('login-form', true);
    toggle('register-form', false);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    if (clearMsg !== false) msg('acc-msg', '', '');
  }

  function paintTfa() {
    if (!el('tfa-box')) return;
    var st = viewState(state);
    var on = twoFactorOn(state.user);
    toggle('tfa-box', st === 'user');
    if (st !== 'user') {
      toggle('tfa-enable-row', false);
      toggle('tfa-disable-row', false);
      toggle('tfa-setup', false);
      toggle('tfa-codes', false);
      toggle('tfa-disable-form', false);
      return;
    }
    var left = recoveryLeft(state.user);
    text('tfa-status', on ? ('已开启' + (left === null ? '' : '（剩余恢复码 ' + left + ' 枚）')) : '未开启');
    var phase = state.tfa.phase;
    var busy = phase === 'setup' || phase === 'codes' || phase === 'disable';
    toggle('tfa-enable-row', !on && !busy);
    toggle('tfa-disable-row', on && !busy);
    toggle('tfa-setup', phase === 'setup');
    toggle('tfa-codes', phase === 'codes');
    toggle('tfa-disable-form', phase === 'disable');
    disabled('tfa-enable', !state.connected);
    disabled('tfa-disable-open', !state.connected);
    disabled('tfa-enable-btn', !state.connected);
    disabled('tfa-disable-btn', !state.connected);
    disabled('tfa-disable-input', !state.connected);
  }

  function paint() {
    if (!el('account-panel')) return;
    var st = viewState(state);
    toggle('acc-offline', st === 'offline');
    toggle('acc-guest', st === 'guest');
    toggle('acc-user', st === 'user');
    text('acc-state', st === 'user' ? '已登录' : (st === 'offline' ? '未连接' : '未登录'));
    ['login-email', 'login-password', 'register-email', 'register-password',
      'register-password2', 'login-btn', 'register-btn', 'login-2fa-code',
      'login-2fa-btn'].forEach(function (id) {
      disabled(id, st === 'offline');
    });
    if (state.user) {
      text('acc-name', userLabel(state.user));
      text('acc-mc', mcLabel(state.user.mc));
    }
    paintLoginMode();
    paintTfa();
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
    ['login-password', 'register-password', 'register-password2', 'login-2fa-code',
      'tfa-enable-code', 'tfa-disable-input'].forEach(function (id) {
      var n = el(id);
      if (n) n.value = '';
    });
  }

  function switchTab(name) {
    if (state.tfa.phase === 'login') resetLoginChallenge(false);
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-auth-tab') === name ? 'true' : 'false');
    });
    toggle('auth-tabs', true);
    toggle('login-form', name === 'login');
    toggle('register-form', name === 'register');
    toggle('login-2fa-form', false);
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

  function applyMe(d) {
    state.connected = true;
    var prev = userKey(state.user);
    var u = normalizeMe(d);
    state.user = u;
    if (userKey(u) !== prev) resetTfaState(false);
    paint();
    loadOrders();
    return u;
  }

  function refreshMe() {
    return MCW.api.get('/api/me').then(function (d) {
      return applyMe(d);
    }, function (err) {
      if (err && (err.status === 401 || err.code === 'unauthorized')) {
        state.connected = true;
        state.user = null;
      } else {
        state.connected = false;
        state.user = null;
      }
      resetTfaState(false);
      resetLoginChallenge(false);
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
      resetTfaState(false);
      resetLoginChallenge(false);
      paint();
      loadOrders();
      msg('acc-msg', '已退出登录', 'ok');
    }, function (err) {
      msg('acc-msg', (err && err.message) || '退出失败', 'err');
    });
  }

  function login(email, password) {
    return loginRequest(email, password).then(function (d) {
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true, challengeId: state.tfa.challengeId };
      }
      return MCW.api.get('/api/me').then(function (me) {
        return { user: applyMe(me) };
      }, function (err) {
        if (err && err.status === 401) return { user: null };
        throw err;
      });
    });
  }

  function verifyChallenge(code) {
    if (!state.tfa.challengeId) {
      var e = new Error('验证会话已失效，请重新登录');
      e.code = 'challenge_missing';
      return Promise.reject(e);
    }
    return verifyRequest(state.tfa.challengeId, code).then(function (d) {
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true };
      }
      resetLoginChallenge(false);
      return MCW.api.get('/api/me').then(function (me) {
        return { user: applyMe(me) };
      }, function (err) {
        if (err && err.status === 401) {
          var e2 = new Error('登录状态异常，请重试');
          e2.code = 'session_missing';
          throw e2;
        }
        throw err;
      });
    });
  }

  function submitChallenge() {
    var c = el('login-2fa-code');
    var code = c ? c.value.trim() : '';
    if (!code) { msg('acc-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'login-2fa-btn', '验证中…');
    verifyChallenge(code).then(function (res) {
      if (res && res.challenge) { msg('acc-msg', '请继续输入验证码', 'ok'); return; }
      if (!res || !res.user) { msg('acc-msg', '登录状态异常，请重试', 'err'); return; }
      msg('acc-msg', '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      msg('acc-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'login-2fa-btn');
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
        return login(u, p);
      })
      : login(u, p);
    first.then(function (res) {
      if (res && res.challenge) {
        clearPasswords();
        msg('acc-msg', '该账号已开启两步验证，请输入 6 位验证码或恢复码。', 'ok');
        return;
      }
      if (!res || !res.user) {
        if (isReg) switchTab('login');
        msg('acc-msg', isReg ? '注册成功，请登录' : '登录状态异常，请重试', isReg ? 'ok' : 'err');
        return;
      }
      msg('acc-msg', isReg ? '注册成功，已登录' : '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      msg('acc-msg', authError(err), 'err');
    }).then(function () {
      setBusy(false, btnId);
    });
  }

  function startTfaSetup() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable', '生成中…');
    MCW.api.post('/api/2fa/setup', {}).then(function (d) {
      d = d || {};
      state.tfa.phase = 'setup';
      state.tfa.secret = String(d.secret || '').trim();
      state.tfa.otpauthUrl = String(d.otpauthUrl || d.otpauth_url || d.uri || '').trim();
      state.tfa.rendered = false;
      text('tfa-secret', state.tfa.secret || '—');
      text('tfa-otpauth', state.tfa.otpauthUrl || '—');
      var sc = el('tfa-copy-secret');
      if (sc) { sc.setAttribute('data-copy', state.tfa.secret); sc.disabled = !state.tfa.secret; }
      var su = el('tfa-copy-uri');
      if (su) { su.setAttribute('data-copy', state.tfa.otpauthUrl); su.disabled = !state.tfa.otpauthUrl; }
      var code = el('tfa-enable-code');
      if (code) code.value = '';
      paintTfa();
      msg('tfa-msg', '密钥已生成，请用验证器 App 添加后输入 6 位验证码。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable');
    });
  }

  function renderRecoveryCodes(codes) {
    if (state.tfa.rendered) return false;
    var list = (codes || []).map(function (c) {
      return String(c === null || c === undefined ? '' : c).trim();
    }).filter(function (c) { return !!c; });
    if (!list.length) return false;
    var box = el('tfa-code-list');
    if (!box) return false;
    box.innerHTML = list.map(function (c) {
      return '<span class="mono">' + MCW.esc(c) + '</span>';
    }).join('');
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', list.join('\n')); cp.disabled = false; }
    state.tfa.codes = list;
    state.tfa.rendered = true;
    return true;
  }

  function submitTfaEnable() {
    var c = el('tfa-enable-code');
    var code = c ? c.value.trim() : '';
    if (!/^\d{6}$/.test(code)) { msg('tfa-msg', '请输入 6 位数字验证码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable-btn', '验证中…');
    MCW.api.post('/api/2fa/enable', { code: code }).then(function (d) {
      var codes = recoveryCodesOf(d);
      if (state.user) {
        state.user.twoFactor = true;
        state.user.recoveryCodesLeft = codes.length;
      }
      state.tfa.rendered = false;
      if (codes.length) {
        state.tfa.phase = 'codes';
        renderRecoveryCodes(codes);
        paintTfa();
        msg('tfa-msg', '两步验证已开启，请保存恢复码。', 'ok');
      } else {
        state.tfa.phase = 'idle';
        paintTfa();
        msg('tfa-msg', '两步验证已开启，但服务端未返回恢复码，请联系管理员。', 'err');
      }
      var ec = el('tfa-enable-code');
      if (ec) ec.value = '';
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable-btn');
    });
  }

  function closeRecoveryCodes() {
    state.tfa.phase = 'idle';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    paintTfa();
    msg('tfa-msg', '恢复码已关闭。', 'ok');
  }

  function syncDisableInput() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    if (!input) return;
    var isCode = !sel || sel.value !== 'password';
    input.setAttribute('type', isCode ? 'text' : 'password');
    input.setAttribute('inputmode', isCode ? 'numeric' : 'text');
    input.setAttribute('placeholder', isCode ? '123456 或恢复码' : '当前账号密码');
    input.setAttribute('autocomplete', isCode ? 'one-time-code' : 'current-password');
  }

  function openTfaDisable() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    state.tfa.phase = 'disable';
    var sel = el('tfa-disable-method');
    if (sel) sel.value = 'code';
    var input = el('tfa-disable-input');
    if (input) input.value = '';
    syncDisableInput();
    paintTfa();
    msg('tfa-msg', '', '');
  }

  function submitTfaDisable() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    var method = sel && sel.value === 'password' ? 'password' : 'code';
    var val = input ? input.value : '';
    if (!val) { msg('tfa-msg', method === 'password' ? '请输入账号密码' : '请输入验证码或恢复码', 'err'); return; }
    if (method === 'code' && val.length < 6) { msg('tfa-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-disable-btn', '关闭中…');
    var body = method === 'password' ? { password: val } : { code: val };
    MCW.api.post('/api/2fa/disable', body).then(function () {
      if (state.user) {
        state.user.twoFactor = false;
        state.user.recoveryCodesLeft = 0;
      }
      state.tfa.phase = 'idle';
      state.tfa.secret = '';
      state.tfa.otpauthUrl = '';
      state.tfa.codes = [];
      state.tfa.rendered = false;
      var di = el('tfa-disable-input');
      if (di) di.value = '';
      paintTfa();
      msg('tfa-msg', '两步验证已关闭。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-disable-btn');
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

  function tfaSnapshot() {
    return {
      phase: state.tfa.phase,
      challengeId: state.tfa.challengeId,
      secret: state.tfa.secret,
      otpauthUrl: state.tfa.otpauthUrl,
      codes: state.tfa.codes.slice(),
      rendered: state.tfa.rendered
    };
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
    var l2f = el('login-2fa-form');
    if (l2f) l2f.addEventListener('submit', function (e) { e.preventDefault(); submitChallenge(); });
    var l2b = el('login-2fa-back');
    if (l2b) l2b.addEventListener('click', function () { resetLoginChallenge(true); });
    var te = el('tfa-enable');
    if (te) te.addEventListener('click', startTfaSetup);
    var tsc = el('tfa-setup-cancel');
    if (tsc) tsc.addEventListener('click', function () { resetTfaState(true); });
    var tef = el('tfa-enable-form');
    if (tef) tef.addEventListener('submit', function (e) { e.preventDefault(); submitTfaEnable(); });
    var tcs = el('tfa-codes-saved');
    if (tcs) tcs.addEventListener('click', closeRecoveryCodes);
    var tdo = el('tfa-disable-open');
    if (tdo) tdo.addEventListener('click', openTfaDisable);
    var tdm = el('tfa-disable-method');
    if (tdm) tdm.addEventListener('change', syncDisableInput);
    var tdb = el('tfa-disable-btn');
    if (tdb) tdb.addEventListener('click', submitTfaDisable);
    var tdc = el('tfa-disable-cancel');
    if (tdc) tdc.addEventListener('click', function () { resetTfaState(true); });
    var tdi = el('tfa-disable-input');
    if (tdi) tdi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitTfaDisable(); }
    });
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
    twoFactorOn: twoFactorOn,
    normalizeMe: normalizeMe,
    isTwoFactorRequired: isTwoFactorRequired,
    challengeIdOf: challengeIdOf,
    recoveryCodesOf: recoveryCodesOf,
    showLoginChallenge: showLoginChallenge,
    resetLoginChallenge: resetLoginChallenge,
    login: login,
    verifyChallenge: verifyChallenge,
    renderRecoveryCodes: renderRecoveryCodes,
    tfaSnapshot: tfaSnapshot,
    mount: mount,
    refresh: refreshMe
  };

  MCW.ready(mount);
})();
