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

  function paintAccount() {
    var els = MCW.qsa('[data-account-link]');
    if (!els.length) return;
    var url = MCW.api.accountUrl();
    els.forEach(function (el) {
      if (!url) {
        el.classList.add('is-off');
        el.setAttribute('aria-disabled', 'true');
        el.removeAttribute('href');
        el.setAttribute('title', '暂未开放');
        var note = el.querySelector('[data-account-note]');
        if (note) note.textContent = '暂未开放';
        return;
      }
      el.setAttribute('href', url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
      var n2 = el.querySelector('[data-account-note]');
      if (n2) n2.textContent = '';
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