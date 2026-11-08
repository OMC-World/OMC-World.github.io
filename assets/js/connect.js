/* 连接指引页：地址复制、版本说明、API 契约与连通性自检 */
(function () {
  'use strict';
  var MCW = window.MCW;

  function fillAddress() {
    var host = window.MCWORLD_HOST || 'play.mc-world.example';
    var port = window.MCWORLD_PORT || 25565;
    var addr = host + ':' + port;
    var el = document.getElementById('conn-addr');
    if (el) el.textContent = addr;
    MCW.qsa('[data-copy-addr]').forEach(function (b) { b.setAttribute('data-copy', addr); });
  }

  function renderContract() {
    var tbody = document.getElementById('contract-body');
    if (!tbody) return;
    tbody.innerHTML = MCW.api.contract.map(function (c) {
      return '<tr><td><span class="badge ' + (c.method === 'GET' ? 'badge-info' : 'badge-warn') + '">' + c.method + '</span></td>' +
        '<td><code>' + MCW.esc(c.path) + '</code></td>' +
        '<td class="mono dim">' + MCW.esc(c.req) + '</td>' +
        '<td class="mono">' + MCW.esc(c.res) + '</td></tr>';
    }).join('');
  }

  function checkApi() {
    var out = document.getElementById('api-check-result');
    if (!out) return;
    out.className = 'banner';
    out.textContent = '正在检测…';
    MCW.api.getStatus().then(function (r) {
      var live = r.source === 'live';
      out.className = 'banner ' + (live ? 'banner-ok' : 'banner-warn');
      out.innerHTML = live
        ? '<div><b>API 在线</b>：' + MCW.esc(MCW.api.base()) + ' 返回 ' + (r.servers || []).length + ' 台服务器，更新于 ' + MCW.esc(MCW.fmtTime(r.updatedAt)) + '。</div>'
        : '<div><b>API 不可达</b>：' + MCW.esc(r.error || '网络异常') + '。当前为' + (r.mode === 'demo' ? '演示模式（未配置地址）' : '离线演示') + '，页面功能不受影响。</div>';
    }).catch(function () {
      out.className = 'banner banner-err';
      out.textContent = '检测失败：网络异常。';
    });
  }

  MCW.ready(function () {
    fillAddress();
    renderContract();
    var btn = document.getElementById('api-check-btn');
    if (btn) btn.addEventListener('click', checkApi);
    var modeEl = document.getElementById('conn-mode');
    if (modeEl) {
      modeEl.textContent = MCW.api.mode() === 'live' ? 'API 已配置' : '演示模式（未配置 API）';
      modeEl.className = 'badge ' + (MCW.api.mode() === 'live' ? 'badge-ok' : 'badge-warn');
    }
  });
})();
