/* OMC World 通用工具（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  MCW.esc = function (v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  MCW.num = function (n, digits) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    var d = typeof digits === 'number' ? digits : 0;
    try {
      return v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) {
      return d ? v.toFixed(d) : String(Math.round(v));
    }
  };

  MCW.fmtInt = function (n) { return MCW.num(n, 0); };

  MCW.price = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    if (v >= 1000) return MCW.num(v, 0);
    if (v >= 1) return MCW.num(v, 2);
    return MCW.num(v, 4);
  };

  MCW.pct = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  };

  MCW.dirClass = function (n) {
    var v = Number(n);
    if (!isFinite(v) || v === 0) return 'flat';
    return v > 0 ? 'up' : 'down';
  };

  MCW.clock = function (ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '—';
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };

  MCW.timeAgo = function (ts) {
    var t = typeof ts === 'number' ? ts : new Date(ts).getTime();
    if (!isFinite(t)) return '—';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return '刚刚';
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    return Math.floor(s / 3600) + ' 小时前';
  };

  MCW.qs = function (sel, root) { return (root || document).querySelector(sel); };
  MCW.qsa = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  MCW.ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  MCW.toast = function (msg, kind) {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = String(msg);
    host.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 2600);
  };

  MCW.copy = function (text) {
    var value = String(text === null || text === undefined ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; }).catch(function () { return fallback(value); });
    }
    return Promise.resolve(fallback(value));

    function fallback(v) {
      try {
        var ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
  };

  MCW.initCopy = function () {
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-copy]') : null;
      if (!el) return;
      ev.preventDefault();
      var text = el.getAttribute('data-copy');
      MCW.copy(text).then(function (ok) {
        MCW.toast(ok ? '已复制：' + text : '复制失败，请手动选择', ok ? 'ok' : 'err');
      });
    });
  };

  MCW.params = function () {
    var out = {};
    var q = String(window.location.search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      out[k] = v;
    });
    return out;
  };
})();
