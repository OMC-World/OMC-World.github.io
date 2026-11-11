/* OMC World 纯 SVG 图表：折线 / 柱状 / 迷你线（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var COLOR = { line: '#f2c14e', grid: '#1e232b', axis: '#2b313a', text: '#7d8590', up: '#4ade80', down: '#f85149' };

  function seriesOf(points) {
    var arr = [];
    (points || []).forEach(function (pt) {
      if (pt === null || pt === undefined) return;
      var t = pt.t !== undefined ? pt.t : (pt.ts !== undefined ? pt.ts : pt.time);
      var p = pt.p !== undefined ? pt.p : pt.price;
      var ts = typeof t === 'number' ? (t < 1e12 ? t * 1000 : t) : Date.parse(t);
      var pv = Number(p);
      if (!isFinite(ts) || !isFinite(pv)) return;
      var vol = pt.v !== undefined ? pt.v : pt.volume;
      var vv = Number(vol);
      arr.push({ t: ts, p: pv, v: isFinite(vv) && vv > 0 ? vv : 0 });
    });
    return arr;
  }

  function fmtAxis(v, opts) {
    if (opts && typeof opts.fmt === 'function') return opts.fmt(v);
    var a = Math.abs(v);
    if (a >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (a >= 100) return String(Math.round(v));
    if (a >= 1) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 1000) / 1000);
  }

  function pad2(x) { return (x < 10 ? '0' : '') + x; }

  function hm(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function dayKey(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* 跨本地日期或跨度超过 24 小时时，x 轴需要带日期，避免 19:23 / 17:49 混排 */
  function hasDateSpan(series) {
    if (!series || series.length < 2) return false;
    var a = series[0].t, b = series[series.length - 1].t;
    if (!isFinite(a) || !isFinite(b)) return false;
    if (Math.abs(b - a) > 86400000) return true;
    return dayKey(a) !== dayKey(b);
  }

  function mdhm(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm(ts);
  }

  function fullTime(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm(ts);
  }

  function esc(v) { return MCW.esc ? MCW.esc(v) : String(v); }

  /* 成交量柱高：按窗口内最大成交量归一；0 / 非数 / 无最大值一律不画 */
  function volumeHeight(v, max, h) {
    var vv = Number(v), mm = Number(max), hh = Number(h);
    if (!isFinite(vv) || !isFinite(mm) || !isFinite(hh) || vv <= 0 || mm <= 0 || hh <= 0) return 0;
    return Math.max(1, Math.round((vv / mm) * hh));
  }

  /* 统一 y 轴范围：全等序列固定 0..max(1,max)，非负数据不出现负刻度 */
  function rangeOf(series) {
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < series.length; i++) {
      if (series[i].p < min) min = series[i].p;
      if (series[i].p > max) max = series[i].p;
    }
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1, equal: true };
    var equal = min === max;
    if (equal) {
      min = 0;
      max = Math.max(1, max);
    } else {
      var pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
      if (min < 0) min = 0;
    }
    if (max <= min) max = min + 1;
    return { min: min, max: max, equal: equal };
  }

  /* 全等序列用整数刻度；其余保持 5 条网格线 */
  function axisTicks(L) {
    if (L.equal) {
      var n = Math.round(L.max);
      if (n >= 1 && n <= 5) {
        var ints = [];
        for (var k = 0; k <= n; k++) ints.push(k);
        return ints;
      }
    }
    var ticks = [];
    for (var j = 0; j <= 4; j++) ticks.push(L.max - ((L.max - L.min) / 4) * j);
    return ticks;
  }

  /* 价格区 + 底部成交量区的共用布局；v 全为 0 时不画柱子，保持原折线布局 */
  function layoutOf(w, h, opts, series, allowVolume) {
    var padL = 54, padR = 16, padT = 16, padB = 26;
    var iw = w - padL - padR;
    var innerH = h - padT - padB;
    var maxV = 0;
    if (opts && opts.volume && allowVolume) {
      series.forEach(function (s) { if (s.v > maxV) maxV = s.v; });
    }
    var hasVol = maxV > 0;
    var gap = hasVol ? 10 : 0;
    var volH = hasVol ? Math.min(64, Math.max(24, Math.round(innerH * 0.28))) : 0;
    if (hasVol && volH + gap > innerH - 20) volH = Math.max(16, innerH - gap - 20);
    var ih = innerH - volH - gap;
    return { padL: padL, padR: padR, padT: padT, padB: padB, iw: iw, ih: ih,
      volTop: padT + ih + gap, volH: volH, hasVol: hasVol, maxV: maxV };
  }

  function lineSVG(points, opts) {
    opts = opts || {};
    var series = seriesOf(points);
    if (!series.length) return '<div class="chart-empty">暂无数据</div>';
    var rawLen = series.length;
    if (series.length === 1) series = [{ t: series[0].t - 60000, p: series[0].p, v: 0 }, series[0]];

    var w = Math.max(240, Number(opts.width) || 720);
    var h = Math.max(120, Number(opts.height) || 260);
    var L = layoutOf(w, h, opts, series, rawLen >= 2);
    var padL = L.padL, padR = L.padR, padT = L.padT;
    var iw = L.iw, ih = L.ih;
    var R = rangeOf(series);
    var min = R.min, max = R.max, i;

    function x(i2) { return padL + (series.length === 1 ? iw / 2 : (i2 / (series.length - 1)) * iw); }
    function y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }

    var color = opts.color || COLOR.line;
    var out = [];
    out.push('<svg class="chart-svg" width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opts.label || '趋势图') + '">');

    var ticks = axisTicks(R);
    for (i = 0; i < ticks.length; i++) {
      var gv = ticks[i];
      var gy = y(gv);
      out.push('<line class="grid" x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) + '" stroke="' + COLOR.grid + '" stroke-width="1"/>');
      out.push('<text class="axis-y" x="' + (padL - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="' + COLOR.text + '" font-size="10">' + esc(fmtAxis(gv, opts)) + '</text>');
    }

    var labels = [0, Math.floor((series.length - 1) / 2), series.length - 1];
    var showDate = hasDateSpan(series);
    labels.forEach(function (idx, k) {
      if (k === 1 && series.length < 3) return;
      var lx = x(idx);
      var anchor = k === 0 ? 'start' : (k === 2 ? 'end' : 'middle');
      var label = showDate && (k === 0 || k === 2) ? mdhm(series[idx].t) : hm(series[idx].t);
      out.push('<text class="axis-x" x="' + lx.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="' + anchor + '" fill="' + COLOR.text + '" font-size="10">' + esc(label) + '</text>');
    });

    var d = '';
    for (i = 0; i < series.length; i++) d += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(series[i].p).toFixed(1) + ' ';
    if (opts.fill !== false) {
      out.push('<path class="area" d="' + d + 'L' + x(series.length - 1).toFixed(1) + ' ' + (padT + ih) + ' L' + x(0).toFixed(1) + ' ' + (padT + ih) + ' Z" fill="' + color + '" fill-opacity="0.07"/>');
    }
    out.push('<path class="line-path" d="' + d.trim() + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>');

    var last = series.length - 1;
    out.push('<circle class="last-dot" cx="' + x(last).toFixed(1) + '" cy="' + y(series[last].p).toFixed(1) + '" r="2.6" fill="' + color + '"/>');

    if (L.hasVol) {
      var bw = Math.max(1, Math.min(18, (iw / Math.max(1, series.length - 1)) * 0.5));
      out.push('<line class="vol-base" x1="' + padL + '" y1="' + (L.volTop + L.volH) + '" x2="' + (w - padR) + '" y2="' + (L.volTop + L.volH) + '" stroke="' + COLOR.axis + '" stroke-width="1"/>');
      out.push('<g class="vol-bars">');
      for (i = 0; i < series.length; i++) {
        var vh = volumeHeight(series[i].v, L.maxV, L.volH);
        if (!vh) continue;
        var bx = Math.min(w - padR - bw, Math.max(padL, x(i) - bw / 2));
        var by = L.volTop + L.volH - vh;
        var up = i === 0 ? true : series[i].p >= series[i - 1].p;
        out.push('<rect class="vol-bar" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + vh + '" fill="' + (up ? COLOR.up : COLOR.down) + '" fill-opacity="0.5" data-v="' + esc(series[i].v) + '"><title>成交量 ' + esc(String(Math.round(series[i].v))) + '</title></rect>');
      }
      out.push('</g>');
    }

    out.push('<g class="chart-hover" opacity="0" pointer-events="none">');
    out.push('<line class="hover-line" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + ih) + '" stroke="' + COLOR.axis + '" stroke-width="1" stroke-dasharray="3 3"/>');
    out.push('<circle class="hover-dot" cx="0" cy="0" r="3.4" fill="' + color + '"/>');
    out.push('<text class="hover-text" x="0" y="0" fill="' + COLOR.text + '" font-size="11"></text>');
    out.push('</g>');

    out.push('<rect class="chart-hit" x="' + padL + '" y="' + padT + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>');
    out.push('</svg>');
    return out.join('');
  }

  function attachHover(el, points, opts) {
    var svg = el.querySelector ? el.querySelector('svg') : null;
    if (!svg) return;
    var series = seriesOf(points);
    if (series.length < 2) return;
    var w = Number(svg.getAttribute('viewBox').split(' ')[2]);
    var h = Number(svg.getAttribute('viewBox').split(' ')[3]);
    var L = layoutOf(w, h, opts, series, series.length >= 2);
    var padL = L.padL, padT = L.padT, iw = L.iw, ih = L.ih;
    var R = rangeOf(series);
    var min = R.min, max = R.max;

    var group = svg.querySelector('.chart-hover');
    var line = svg.querySelector('.hover-line');
    var dot = svg.querySelector('.hover-dot');
    var text = svg.querySelector('.hover-text');
    var hit = svg.querySelector('.chart-hit');
    if (!group || !line || !dot || !text || !hit) return;

    function move(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) * (w / rect.width);
      var ratio = Math.max(0, Math.min(1, (px - padL) / iw));
      var idx = Math.round(ratio * (series.length - 1));
      var sx = padL + (idx / (series.length - 1)) * iw;
      var sy = padT + ih - ((series[idx].p - min) / (max - min)) * ih;
      line.setAttribute('x1', sx.toFixed(1));
      line.setAttribute('x2', sx.toFixed(1));
      dot.setAttribute('cx', sx.toFixed(1));
      dot.setAttribute('cy', sy.toFixed(1));
      text.textContent = fullTime(series[idx].t) + '  ' + (opts && typeof opts.fmt === 'function' ? opts.fmt(series[idx].p) : fmtAxis(series[idx].p, opts));
      var flip = sx > w * 0.72;
      text.setAttribute('x', (sx + (flip ? -8 : 8)).toFixed(1));
      text.setAttribute('y', Math.max(12, sy - 8).toFixed(1));
      text.setAttribute('text-anchor', flip ? 'end' : 'start');
      group.setAttribute('opacity', '1');
    }

    function leave() { group.setAttribute('opacity', '0'); }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchmove', function (ev) {
      if (ev.touches && ev.touches[0]) move(ev.touches[0]);
    }, { passive: true });
  }

  function render(el, points, opts) {
    opts = opts || {};
    if (!el) return;
    var width = Math.max(260, el.clientWidth || opts.width || 720);
    var merged = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) merged[k] = opts[k];
    merged.width = width;
    el.innerHTML = lineSVG(points, merged);
    attachHover(el, points, merged);

    if (typeof ResizeObserver !== 'undefined') {
      if (el._chartRO) el._chartRO.disconnect();
      var lastW = width;
      el._chartRO = new ResizeObserver(function () {
        var nw = Math.max(260, el.clientWidth || width);
        if (Math.abs(nw - lastW) < 8) return;
        lastW = nw;
        merged.width = nw;
        el.innerHTML = lineSVG(points, merged);
        attachHover(el, points, merged);
      });
      el._chartRO.observe(el);
    }
  }

  function spark(points, opts) {
    opts = opts || {};
    var series = seriesOf(points);
    if (series.length < 2) return '<span class="spark-empty">—</span>';
    var w = Number(opts.width) || 96, h = Number(opts.height) || 26;
    var min = Infinity, max = -Infinity;
    series.forEach(function (s) { if (s.p < min) min = s.p; if (s.p > max) max = s.p; });
    if (min === max) { min -= 1; max += 1; }
    var color = opts.color || (series[series.length - 1].p >= series[0].p ? COLOR.up : COLOR.down);
    var d = '';
    series.forEach(function (s, i) {
      var x = (i / (series.length - 1)) * (w - 2) + 1;
      var y = h - 2 - ((s.p - min) / (max - min)) * (h - 4);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + d.trim() + '" fill="none" stroke="' + color + '" stroke-width="1.3"/></svg>';
  }

  function bars(el, items, opts) {
    opts = opts || {};
    if (!el) return;
    items = items || [];
    if (!items.length) { el.innerHTML = '<div class="chart-empty">暂无数据</div>'; return; }
    var w = Math.max(240, el.clientWidth || 720), h = Number(opts.height) || 160;
    var padL = 46, padB = 22, padT = 10, padR = 8;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = 0;
    items.forEach(function (it) { if (Number(it.value) > max) max = Number(it.value); });
    if (!max) max = 1;
    var bw = Math.max(2, Math.min(28, iw / items.length * 0.6));
    var out = ['<svg class="chart-svg" width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'];
    out.push('<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (w - padR) + '" y2="' + (padT + ih) + '" stroke="' + COLOR.axis + '"/>');
    items.forEach(function (it, i) {
      var x = padL + (i + 0.5) * (iw / items.length) - bw / 2;
      var bh = (Number(it.value) / max) * ih;
      out.push('<rect class="bar" x="' + x.toFixed(1) + '" y="' + (padT + ih - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, bh).toFixed(1) + '" fill="' + (opts.color || COLOR.line) + '"><title>' + esc(it.label) + ': ' + esc(fmtAxis(it.value, opts)) + '</title></rect>');
    });
    out.push('</svg>');
    el.innerHTML = out.join('');
  }

  MCW.chart = { line: render, lineSVG: lineSVG, spark: spark, bars: bars, series: seriesOf, volumeHeight: volumeHeight,
    hm: hm, mdhm: mdhm, fullTime: fullTime, hasDateSpan: hasDateSpan };
})();
