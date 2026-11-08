/* MC-World 通用工具（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  MCW.esc = function (v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  MCW.fmtInt = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '0';
    try { return v.toLocaleString('zh-CN'); } catch (e) { return String(v); }
  };

  MCW.fmtTime = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };

  MCW.timeAgo = function (iso) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return '—';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 10) return '刚刚';
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    return Math.floor(s / 86400) + ' 天前';
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

  MCW.roleText = function (role) {
    return ({ login: '登录服', main: '主服', game: '游戏服', mirror: '镜像服' })[role] || (role || '未知');
  };

  MCW.statusText = function (status) {
    return ({ online: '在线', offline: '离线', maintenance: '维护中', full: '满员' })[status] || '未知';
  };

  MCW.statusClass = function (status) {
    if (status === 'online') return 'badge-ok';
    if (status === 'maintenance') return 'badge-warn';
    if (status === 'full') return 'badge-info';
    return 'badge-off';
  };

  MCW.tpsClass = function (tps) {
    var v = Number(tps);
    if (!isFinite(v) || v <= 0) return '';
    if (v >= 19) return '';
    if (v >= 15) return ' warn';
    return ' full';
  };

  MCW.onlineCount = function (s) {
    if (typeof s.online === 'number') return s.online;
    if (Array.isArray(s.players)) return s.players.length;
    return 0;
  };

  MCW.initTabs = function (root) {
    MCW.qsa('[data-tab]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.getAttribute('data-tab-group') || 'default';
        var name = btn.getAttribute('data-tab');
        MCW.qsa('[data-tab][data-tab-group="' + group + '"]', root).forEach(function (b) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        MCW.qsa('[data-panel][data-panel-group="' + group + '"]', root).forEach(function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-panel') !== name);
        });
      });
    });
  };

  MCW.initCopy = function () {
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-copy]') : null;
      if (!el) return;
      ev.preventDefault();
      var text = el.getAttribute('data-copy');
      MCW.copy(text).then(function (ok) {
        MCW.toast(ok ? '已复制：' + text : '复制失败，请手动选择文本', ok ? 'ok' : 'err');
      });
    });
  };

  MCW.currency = [
    { name: '下界合金', cls: 'sw-netherite', value: '1', unit: '块' },
    { name: '钻石', cls: 'sw-diamond', value: '100', unit: '颗' },
    { name: '绿宝石', cls: 'sw-emerald', value: '10K', unit: '颗' },
    { name: '紫水晶', cls: 'sw-amethyst', value: '1M', unit: '枚' },
    { name: '金币', cls: 'sw-gold', value: '100M', unit: '枚' },
    { name: '点数', cls: 'sw-point', value: '10B', unit: '点' }
  ];
})();
