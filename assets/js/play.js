/* 进服页：地址与版本（零依赖）——公网地址只认 /api/link/start 返回值，不硬编码 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var current = '';

  function normalizeAddress(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return '';
    if (/example|your-|待开通|未开通/i.test(s)) return '';
    return s;
  }

  function setServerAddress(raw) {
    var s = normalizeAddress(raw);
    current = s;
    var addr = document.getElementById('addr');
    var cp = document.getElementById('copy-addr');
    if (addr) addr.textContent = s || '待开通';
    if (cp) {
      cp.setAttribute('data-copy', s);
      cp.disabled = !s;
      cp.textContent = s ? '复制' : '未开通';
    }
    return s;
  }

  MCW.play = {
    setServerAddress: setServerAddress,
    normalizeAddress: normalizeAddress,
    address: function () { return current; }
  };

  MCW.ready(function () {
    var ver = CFG.version || '1.21.11';
    var v = document.getElementById('ver');
    if (v) v.textContent = ver;
    setServerAddress('');
  });
})();
