/* 城市时钟：顶栏时间、昼夜状态、页脚年份（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var d = new Date();
    var clock = document.getElementById('city-clock');
    if (clock) {
      clock.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    var phase = document.getElementById('city-phase');
    if (phase) {
      var h = d.getHours();
      var day = h >= 6 && h < 18;
      phase.textContent = day ? '昼间' : '夜间';
      phase.className = day ? 'phase-day' : 'phase-night';
    }
  }

  MCW.ready(function () {
    tick();
    setInterval(tick, 1000);
    var years = document.querySelectorAll('[data-year]');
    for (var i = 0; i < years.length; i++) years[i].textContent = String(new Date().getFullYear());
  });
})();
