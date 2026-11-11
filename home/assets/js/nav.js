/* OMC World 导航、页脚与账号入口（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function paintNav() {
    var path = String(window.location.pathname || '');
    var file = path.split('/').pop() || 'index.html';
    MCW.qsa('.nav a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/^\.\//, '');
      if (href === file || (file === '' && href === 'index.html')) a.classList.add('active');
    });
  }

  /* 账号功能在 play.html 内；accountUrl 配置后优先跳外部账号站 */
  function paintAccount() {
    var els = MCW.qsa('[data-account-link]');
    if (!els.length) return;
    var external = MCW.api.accountUrl();
    var url = external || './play.html';
    els.forEach(function (el) {
      el.classList.remove('is-off');
      el.removeAttribute('aria-disabled');
      el.setAttribute('href', url);
      if (external) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      } else {
        el.removeAttribute('target');
        el.removeAttribute('rel');
      }
      var note = el.querySelector('[data-account-note]');
      if (note) note.textContent = '';
    });
  }

  MCW.ready(function () {
    MCW.initCopy();
    paintNav();
    paintAccount();
    var years = MCW.qsa('[data-year]');
    for (var i = 0; i < years.length; i++) years[i].textContent = String(new Date().getFullYear());
  });
})();
