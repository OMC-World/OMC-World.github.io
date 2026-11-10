/* 进服页：地址与版本（零依赖）——未开通公网入口时显示「待开通」，不展示假地址 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  MCW.ready(function () {
    var host = String(CFG.host || '').trim();
    var port = CFG.port || 25565;
    var ver = CFG.version || '1.21.11';
    var ready = !!host && !/example|your-|待开通|^play\./i.test(host);
    var addr = document.getElementById('addr');
    var cp = document.getElementById('copy-addr');
    if (ready) {
      if (addr) addr.textContent = host + ':' + port;
      if (cp) cp.setAttribute('data-copy', host + ':' + port);
    } else {
      if (addr) addr.textContent = '待开通';
      if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; cp.textContent = '未开通'; }
    }
    var v = document.getElementById('ver');
    if (v) v.textContent = ver;
  });
})();
