/* OMC World 数据接口（零依赖，只读公开接口 + 交易） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var API_KEY = 'omc_api';
  var TIMEOUT = 8000;

  function normalizeBase(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s.replace(/\/+$/, '');
  }

  function base() {
    var q = MCW.params ? MCW.params().api : '';
    if (q) {
      try { sessionStorage.setItem(API_KEY, q); } catch (e) {}
    }
    var stored = '';
    try { stored = sessionStorage.getItem(API_KEY) || ''; } catch (e) {}
    return normalizeBase(stored || CFG.api || '');
  }

  function request(path, opts) {
    opts = opts || {};
    var b = base();
    if (!b) {
      var e0 = new Error('服务端未连接');
      e0.code = 'NOT_CONNECTED';
      return Promise.reject(e0);
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    var headers = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store' };
    if (ctrl) init.signal = ctrl.signal;
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

    return fetch(b + path, init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var info = (data && (data.error || data)) || {};
          var err = new Error(info.message || info.error || ('请求失败（HTTP ' + res.status + '）'));
          err.code = info.code || ('HTTP_' + res.status);
          err.status = res.status;
          throw err;
        }
        if (data && data.ok === false) {
          var info2 = data.error || {};
          var err2 = new Error(info2.message || info2.error || '请求失败');
          err2.code = info2.code || 'API_ERROR';
          throw err2;
        }
        return data;
      });
    }).then(function (data) {
      if (timer) clearTimeout(timer);
      return data;
    }, function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'AbortError') {
        var e = new Error('请求超时');
        e.code = 'TIMEOUT';
        throw e;
      }
      if (!err.code) err.code = 'NETWORK';
      throw err;
    });
  }

  function get(path) { return request(path); }
  function post(path, body) { return request(path, { method: 'POST', body: body || {} }); }

  MCW.api = {
    base: base,
    request: request,
    get: get,
    post: post,
    connected: function () { return !!base(); },
    accountUrl: function () { return String(CFG.accountUrl || ''); },
    health: function () { return get('/api/health'); },
    status: function () { return get('/api/status'); },
    market: function () { return get('/api/market'); },
    stocks: function () { return get('/api/stocks'); },
    stock: function (symbol) { return get('/api/stocks/' + encodeURIComponent(symbol)); },
    trade: function (body) { return post('/api/stocks/trade', body); },
    plots: function () { return get('/api/plots'); },
    contract: [
      'GET /api/health',
      'GET /api/status',
      'GET /api/market',
      'GET /api/stocks',
      'GET /api/stocks/<symbol>',
      'POST /api/stocks/trade',
      'GET /api/plots'
    ]
  };
})();
