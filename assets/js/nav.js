/* MC-World 全站导航：API 状态灯、登录态、标签页与复制按钮 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function paintMode(result) {
    var dot = document.getElementById('api-dot');
    var label = document.getElementById('api-label');
    if (!dot || !label) return;
    var m = result && result.mode ? result.mode : MCW.api.mode();
    dot.className = 'status-dot ' + (m === 'live' ? 'on' : (m === 'offline' ? 'off' : 'demo'));
    label.textContent = m === 'live' ? '服务在线' : (m === 'offline' ? '离线演示' : '演示模式');
    label.title = m === 'live'
      ? '已连接 Worker API：' + MCW.api.base()
      : (m === 'offline' ? 'API 不可达，当前使用内置演示数据' : '未配置 API 地址，当前使用内置演示数据');
  }

  function paintUser() {
    var el = document.getElementById('header-user');
    if (!el) return;
    var user = MCW.api.getUser();
    if (!user) {
      el.innerHTML = '<a href="./account.html">登录 / 注册</a>';
    } else {
      var demo = MCW.api.isDemoSession();
      el.innerHTML = '你好，<b>' + MCW.esc(user) + '</b>' + (demo ? ' <span class="badge badge-warn">演示</span>' : '');
    }
  }

  MCW.ready(function () {
    MCW.initTabs(document);
    MCW.initCopy();
    paintUser();
    paintMode(null);

    var path = window.location.pathname;
    MCW.qsa('.nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var file = href.replace(/^\.\//, '');
      if (file && path.indexOf(file) !== -1) a.classList.add('active');
    });

    if (MCW.api.mode() === 'live') {
      MCW.api.getStatus().then(paintMode).catch(function () {
        paintMode({ mode: 'offline' });
      });
    }
  });
})();
