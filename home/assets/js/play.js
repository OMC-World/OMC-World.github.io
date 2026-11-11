/* 进服页：地址与版本（零依赖）——地址统一由 address.js 自愈，登录后 /api/link/start 可直接覆盖 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function refreshServerAddress() {
    return MCW.address.refresh('/api/status', 'serverAddress');
  }

  function setServerAddress(raw) {
    return MCW.address.set(raw);
  }

  MCW.play = {
    refreshServerAddress: refreshServerAddress,
    setServerAddress: setServerAddress,
    normalizeAddress: MCW.address.normalize,
    address: function () { return MCW.address.current(); }
  };

  MCW.ready(function () {
    MCW.address.start(refreshServerAddress);
  });
})();
