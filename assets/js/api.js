/* MC-World API 客户端：零依赖、超时可控、失败自动降级 mock */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var DEFAULT_BASE = 'https://mc-world-api.<account>.workers.dev';
  var TIMEOUT = 5000;

  function readOverride() {
    var fromQuery = '';
    try {
      var p = new URLSearchParams(window.location.search);
      fromQuery = (p.get('api') || '').trim();
    } catch (e) { fromQuery = ''; }
    if (fromQuery) {
      try { sessionStorage.setItem('mcw_api', fromQuery); } catch (e2) {}
      return fromQuery;
    }
    try { return (sessionStorage.getItem('mcw_api') || '').trim(); } catch (e3) { return ''; }
  }

  function usable(base) {
    if (!base) return false;
    if (/[<>]/.test(base)) return false;              // 仍是占位符
    if (/example\.com|example\.dev/i.test(base)) return false;
    return /^https?:\/\/[^\s]+$/i.test(base);
  }

  var configured = (window.MCWORLD_API || DEFAULT_BASE).trim();
  var override = readOverride();
  var base = usable(override) ? override : (usable(configured) ? configured : '');
  var mode = base ? 'live' : 'demo';

  function request(path, opts) {
    opts = opts || {};
    if (!base) {
      return Promise.resolve({ ok: false, mode: 'demo', error: '未配置 API 地址（演示模式）' });
    }
    var url = base.replace(/\/+$/, '') + path;
    var ctrl = null;
    try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, opts.timeout || TIMEOUT);
    var init = {
      method: opts.method || 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      credentials: 'omit'
    };
    if (opts.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    if (ctrl) init.signal = ctrl.signal;

    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        clearTimeout(timer);
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          return { ok: false, mode: 'offline', status: res.status, data: data, error: 'HTTP ' + res.status };
        }
        return { ok: true, mode: 'live', status: res.status, data: data };
      });
    }).catch(function (err) {
      clearTimeout(timer);
      var msg = (err && err.name === 'AbortError') ? '请求超时' : '网络不可达';
      return { ok: false, mode: 'offline', status: 0, data: null, error: msg };
    });
  }

  function fallbackMode() { return mode === 'demo' ? 'demo' : 'offline'; }

  function getStatus() {
    return request('/api/status').then(function (r) {
      var d = r.data;
      if (r.ok && d && d.ok !== false && Array.isArray(d.servers)) {
        return { ok: true, mode: 'live', servers: d.servers, updatedAt: d.updatedAt || new Date().toISOString(), source: 'live' };
      }
      var m = MCW.mock.status();
      return { ok: false, mode: fallbackMode(), servers: m.servers, updatedAt: m.updatedAt, source: 'mock', error: r.error || '接口返回异常' };
    });
  }

  function getServers() {
    return request('/api/servers').then(function (r) {
      var d = r.data;
      if (r.ok && d && d.ok !== false && Array.isArray(d.servers)) {
        return { ok: true, mode: 'live', servers: d.servers, source: 'live' };
      }
      var m = MCW.mock.servers();
      return { ok: false, mode: fallbackMode(), servers: m.servers, source: 'mock', error: r.error || '接口返回异常' };
    });
  }

  function auth(kind, username, password) {
    var path = kind === 'register' ? '/api/auth/register' : '/api/auth/login';
    if (!base) {
      return Promise.resolve({ ok: true, mode: 'demo', demo: true, token: 'demo.' + btoa(unescape(encodeURIComponent(username))), error: '' });
    }
    return request(path, { method: 'POST', body: { username: username, password: password } }).then(function (r) {
      var d = r.data || {};
      if (r.ok && d.ok === true && d.token) {
        return { ok: true, mode: 'live', token: d.token, error: '' };
      }
      return {
        ok: false,
        mode: r.mode,
        error: d.error || r.error || '服务暂时不可用，请稍后再试'
      };
    });
  }

  function redirect(player) {
    return request('/api/redirect?player=' + encodeURIComponent(player || '')).then(function (r) {
      if (r.ok && r.data && r.data.ok === true && r.data.server) {
        return { ok: true, mode: 'live', server: r.data.server };
      }
      return { ok: false, mode: r.mode, error: (r.data && r.data.error) || r.error || '分配失败' };
    });
  }

  function getToken() {
    try { return localStorage.getItem('mcw_token') || ''; } catch (e) { return ''; }
  }

  function getUser() {
    try { return localStorage.getItem('mcw_user') || ''; } catch (e) { return ''; }
  }

  function isDemoSession() {
    return getToken().indexOf('demo.') === 0;
  }

  function setSession(token, username) {
    try {
      localStorage.setItem('mcw_token', token || '');
      localStorage.setItem('mcw_user', username || '');
    } catch (e) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem('mcw_token');
      localStorage.removeItem('mcw_user');
    } catch (e) {}
  }

  MCW.api = {
    getStatus: getStatus,
    getServers: getServers,
    register: function (u, p) { return auth('register', u, p); },
    login: function (u, p) { return auth('login', u, p); },
    redirect: redirect,
    getToken: getToken,
    getUser: getUser,
    isDemoSession: isDemoSession,
    setSession: setSession,
    clearSession: clearSession,
    mode: function () { return mode; },
    base: function () { return base; },
    contract: [
      { method: 'GET', path: '/api/status', req: '—', res: '{ok, servers:[{id,role,name,online,max,players,tps,latency,status}], updatedAt}' },
      { method: 'GET', path: '/api/servers', req: '—', res: '{ok, servers:[{id,role,port,host,name,desc}]}' },
      { method: 'POST', path: '/api/auth/register', req: '{username,password}', res: '{ok:true,token} | {ok:false,error}' },
      { method: 'POST', path: '/api/auth/login', req: '{username,password}', res: '{ok:true,token} | {ok:false,error}' },
      { method: 'GET', path: '/api/redirect?player=x', req: '—', res: '{ok:true,server:{id,host,port}}' }
    ]
  };
})();
