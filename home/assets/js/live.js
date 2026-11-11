/* OMC World 轮询与连接状态机（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};

  function Poller(path, opts) {
    opts = opts || {};
    this.path = path;
    this.interval = Math.max(2000, Number(opts.interval || CFG.pollMs || 5000));
    this.data = null;
    this.state = 'connecting';
    this.lastOk = 0;
    this.downSince = 0;
    this.error = '';
    this.busy = false;
    this.timer = null;
    this.listeners = [];
  }

  Poller.prototype.on = function (fn) {
    this.listeners.push(fn);
    return this;
  };

  Poller.prototype.emit = function () {
    var self = this;
    this.listeners.forEach(function (fn) { try { fn(self); } catch (e) {} });
  };

  Poller.prototype.start = function () {
    var self = this;
    this.tick();
    this.timer = setInterval(function () { self.tick(); }, this.interval);
    return this;
  };

  Poller.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  };

  Poller.prototype.tick = function () {
    var self = this;
    if (this.busy) return Promise.resolve(this);
    this.busy = true;
    return MCW.api.get(this.path).then(function (data) {
      self.busy = false;
      if (data && data.ok === false) {
        self.fail((data.error && data.error.message) || '接口返回失败');
      } else {
        self.data = data || {};
        self.state = 'live';
        self.lastOk = Date.now();
        self.downSince = 0;
        self.error = '';
      }
      self.emit();
      return self;
    }, function (err) {
      self.busy = false;
      self.fail((err && err.message) || '网络错误');
      self.emit();
      return self;
    });
  };

  Poller.prototype.fail = function (msg) {
    this.state = this.data ? 'stale' : 'down';
    if (!this.downSince) this.downSince = Date.now();
    this.error = msg || '';
  };

  function label(state) {
    if (state === 'live') return '实时';
    if (state === 'stale') return '连接中断';
    if (state === 'connecting') return '连接中';
    return '服务端未连接';
  }

  function hint(state) {
    if (state === 'live') return '';
    if (state === 'stale') return '显示的是最后一次成功数据';
    if (state === 'connecting') return '正在请求数据';
    return '游戏内使用 /stock buy <代码> <数量>';
  }

  MCW.live = {
    make: function (path, opts) { return new Poller(path, opts); },
    label: label,
    hint: hint,
    stateClass: function (state) {
      return state === 'live' ? 'ok' : (state === 'stale' ? 'warn' : 'off');
    }
  };
})();
