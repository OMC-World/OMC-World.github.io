/* 公网连接地址自愈：/api/status -> serverAddress，首屏立即拉取，之后每 15 秒刷新（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var INTERVAL = 15000;
  var timer = null;
  var currentAddress = '';
  var currentVersion = '';
  var baseVersion = String(CFG.version || '1.21.11').split('~')[0].trim() || '1.21.11';

  function normalize(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return '';
    if (/example|your-|待开通|未开通/i.test(s)) return '';
    return s;
  }

  function paintAddress() {
    var addr = document.getElementById('addr');
    var cp = document.getElementById('copy-addr');
    if (addr) addr.textContent = currentAddress || '待开通';
    if (cp) {
      cp.setAttribute('data-copy', currentAddress);
      cp.disabled = !currentAddress;
      cp.textContent = currentAddress ? '复制' : '未开通';
    }
  }

  function formatVersion(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return '—';
    if (s.indexOf('~') !== -1) return s;
    if (s === baseVersion) return s;
    return baseVersion + ' ~ ' + s;
  }

  function paintVersion() {
    var txt = formatVersion(currentVersion);
    ['addr-version', 'ver'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = txt;
    });
  }

  function set(raw) {
    currentAddress = normalize(raw);
    paintAddress();
    return currentAddress;
  }

  function setVersion(raw) {
    currentVersion = String(raw === null || raw === undefined ? '' : raw).trim();
    paintVersion();
  }

  /* path / field 默认 /api/status + serverAddress；登录后的 /api/link/start 可直接调用 set() 覆盖 */
  function refresh(path, field) {
    path = path || '/api/status';
    field = field || 'serverAddress';
    if (!MCW.api || typeof MCW.api.get !== 'function' ||
        (typeof MCW.api.connected === 'function' && !MCW.api.connected())) {
      set('');
      setVersion('');
      return Promise.resolve('');
    }
    return MCW.api.get(path).then(function (data) {
      data = data || {};
      set(data[field]);
      setVersion(data.version);
      return currentAddress;
    }, function () {
      /* 网络抖动时保留上一次地址；版本取不到则显示 — */
      setVersion('');
      return currentAddress;
    });
  }

  function start(refresher) {
    var fn = typeof refresher === 'function' ? refresher : refresh;
    fn();
    if (timer) clearInterval(timer);
    timer = setInterval(fn, INTERVAL);
  }

  MCW.address = {
    refresh: refresh,
    start: start,
    set: set,
    normalize: normalize,
    current: function () { return currentAddress; },
    version: function () { return formatVersion(currentVersion); },
    interval: INTERVAL
  };
})();
