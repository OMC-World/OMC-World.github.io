/* 账号页：注册 / 登录 / 本地会话（token 仅存 localStorage） */
(function () {
  'use strict';
  var MCW = window.MCW;

  function msg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'form-msg show ' + (kind || 'info');
    el.textContent = text;
  }
  function clearMsg(id) {
    var el = document.getElementById(id);
    if (el) { el.className = 'form-msg'; el.textContent = ''; }
  }
  function setBusy(form, busy, label) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = busy;
    if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
    btn.textContent = busy ? '处理中…' : (label || btn.getAttribute('data-label'));
  }
  function validName(v) { return /^[A-Za-z0-9_]{3,16}$/.test(v); }

  function renderSession() {
    var token = MCW.api.getToken();
    var user = MCW.api.getUser();
    var session = document.getElementById('session-panel');
    var auth = document.getElementById('auth-panel');
    var tabs = document.getElementById('auth-tabs');
    if (!session || !auth) return;
    if (!token || !user) {
      session.classList.add('hidden');
      auth.classList.remove('hidden');
      if (tabs) tabs.classList.remove('hidden');
      return;
    }
    session.classList.remove('hidden');
    auth.classList.add('hidden');
    if (tabs) tabs.classList.add('hidden');
    var uEl = document.getElementById('session-user');
    if (uEl) uEl.textContent = user;
    var tEl = document.getElementById('session-token');
    if (tEl) {
      var demo = MCW.api.isDemoSession();
      tEl.textContent = demo ? '本地演示令牌（未连接后端）' : (token.length > 18 ? token.slice(0, 10) + '…' + token.slice(-6) : token);
    }
    var warn = document.getElementById('session-demo');
    if (warn) warn.classList.toggle('hidden', !MCW.api.isDemoSession());
    var src = document.getElementById('session-source');
    if (src) src.textContent = MCW.api.mode() === 'live' ? '已连接 Worker API' : '演示模式（未连接后端）';
  }

  function submitAuth(kind, form, msgId) {
    var u = (form.querySelector('[name="username"]') || {}).value || '';
    var p = (form.querySelector('[name="password"]') || {}).value || '';
    u = u.trim();
    clearMsg(msgId);
    if (!validName(u)) { msg(msgId, '用户名需为 3–16 位字母、数字或下划线。', 'err'); return; }
    if (p.length < 8) { msg(msgId, '密码至少 8 位，建议混合字母与数字。', 'err'); return; }
    if (kind === 'register') {
      var p2El = form.querySelector('[name="password2"]');
      if (p2El && p2El.value !== p) { msg(msgId, '两次输入的密码不一致。', 'err'); return; }
    }
    setBusy(form, true);
    var call = kind === 'register' ? MCW.api.register(u, p) : MCW.api.login(u, p);
    call.then(function (r) {
      setBusy(form, false);
      if (r.ok && r.token) {
        MCW.api.setSession(r.token, u);
        renderSession();
        MCW.toast(kind === 'register' ? '注册成功，已自动登录' : '登录成功', 'ok');
        if (r.demo) msg(msgId, '演示模式：未连接后端，登录状态仅保存在本机浏览器。', 'info');
      } else {
        msg(msgId, '失败：' + (r.error || '未知错误'), 'err');
      }
    }).catch(function () {
      setBusy(form, false);
      msg(msgId, '网络异常，请稍后重试。', 'err');
    });
  }

  MCW.ready(function () {
    var loginForm = document.getElementById('login-form');
    var regForm = document.getElementById('register-form');
    if (loginForm) loginForm.addEventListener('submit', function (e) { e.preventDefault(); submitAuth('login', loginForm, 'login-msg'); });
    if (regForm) regForm.addEventListener('submit', function (e) { e.preventDefault(); submitAuth('register', regForm, 'register-msg'); });

    var logout = document.getElementById('logout-btn');
    if (logout) logout.addEventListener('click', function () {
      MCW.api.clearSession();
      renderSession();
      MCW.toast('已退出登录（本地令牌已清除）', 'ok');
    });

    var demoNote = document.getElementById('account-mode-note');
    if (demoNote) {
      demoNote.textContent = MCW.api.mode() === 'live'
        ? '已连接 API：' + MCW.api.base()
        : '演示模式：未配置 API 地址，注册/登录仅在本地生效。';
    }
    renderSession();
  });
})();
