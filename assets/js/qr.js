/* 极简 QR 编码器（字节模式 / 纠错等级 M / 版本 1–15），零依赖，用于 otpauth 二维码 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function genPoly(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = [];
      for (var k = 0; k < poly.length + 1; k++) next.push(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = genPoly(ecLen);
    var res = new Uint8Array(data.length + ecLen);
    res.set(data, 0);
    for (var i = 0; i < data.length; i++) {
      var factor = res[i];
      if (factor === 0) continue;
      for (var j = 1; j < gen.length; j++) res[i + j] ^= mul(gen[j], factor);
    }
    return res.subarray(data.length);
  }

  /* [块数, 块总码字, 块数据码字]（纠错等级 M） */
  var RS = {
    1: [[1, 26, 16]],
    2: [[1, 44, 28]],
    3: [[1, 70, 44]],
    4: [[2, 50, 32]],
    5: [[2, 67, 43]],
    6: [[4, 43, 27]],
    7: [[4, 49, 31]],
    8: [[2, 60, 38], [2, 61, 39]],
    9: [[3, 58, 36], [2, 59, 37]],
    10: [[4, 69, 43], [1, 70, 44]],
    11: [[1, 80, 50], [4, 81, 51]],
    12: [[6, 58, 36], [2, 59, 37]],
    13: [[8, 59, 37], [1, 60, 38]],
    14: [[4, 64, 40], [5, 65, 41]],
    15: [[5, 65, 41], [5, 66, 42]]
  };

  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
    15: [6, 26, 48, 70]
  };

  function dataCodewords(version) {
    var n = 0;
    RS[version].forEach(function (g) { n += g[0] * g[2]; });
    return n;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      var arr = new TextEncoder().encode(str);
      return Array.prototype.slice.call(arr);
    }
    var s = unescape(encodeURIComponent(str));
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function pickVersion(len) {
    for (var v = 1; v <= 15; v++) {
      var need = 4 + (v < 10 ? 8 : 16) + len * 8;
      if (need <= dataCodewords(v) * 8) return v;
    }
    return 0;
  }

  function buildData(bytes, version) {
    var cap = dataCodewords(version);
    var bits = [];
    function put(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    put(4, 4);
    put(bytes.length, version < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);
    var total = cap * 8;
    if (bits.length > total) return null;
    put(0, Math.min(4, total - bits.length));
    while (bits.length % 8) bits.push(0);
    var out = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
      out.push(byte);
    }
    var pad = [0xEC, 0x11];
    var p = 0;
    while (out.length < cap) out.push(pad[p++ % 2]);
    return out;
  }

  function interleave(data, version) {
    var groups = RS[version];
    var blocks = [];
    var ecBlocks = [];
    var offset = 0;
    groups.forEach(function (g) {
      for (var i = 0; i < g[0]; i++) {
        var d = data.slice(offset, offset + g[2]);
        offset += g[2];
        blocks.push(d);
        ecBlocks.push(rsEncode(d, g[1] - g[2]));
      }
    });
    var out = [];
    var maxData = 0;
    blocks.forEach(function (b) { if (b.length > maxData) maxData = b.length; });
    for (var i = 0; i < maxData; i++) {
      blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    }
    var maxEc = 0;
    ecBlocks.forEach(function (b) { if (b.length > maxEc) maxEc = b.length; });
    for (var j = 0; j < maxEc; j++) {
      ecBlocks.forEach(function (b) { if (j < b.length) out.push(b[j]); });
    }
    return out;
  }

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
      default: return false;
    }
  }

  function bchFormat(mask) {
    var d = (0 << 3) | mask; /* 纠错等级 M 的指示位为 00 */
    var rem = d;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((d << 10) | rem) ^ 0x5412;
  }

  function bchVersion(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | rem;
  }

  function baseMatrix(version) {
    var size = version * 4 + 17;
    var m = [];
    var fixed = [];
    for (var i = 0; i < size; i++) {
      var row = [];
      var frow = [];
      for (var j = 0; j < size; j++) { row.push(0); frow.push(false); }
      m.push(row);
      fixed.push(frow);
    }
    function set(r, c, v) {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      m[r][c] = v ? 1 : 0;
      fixed[r][c] = true;
    }
    function finder(r0, c0) {
      for (var i = -1; i <= 7; i++) {
        for (var j = -1; j <= 7; j++) {
          var on = (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
            (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4);
          set(r0 + i, c0 + j, on);
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    for (var t = 8; t < size - 8; t++) {
      set(6, t, t % 2 === 0);
      set(t, 6, t % 2 === 0);
    }

    var al = ALIGN[version];
    for (var a = 0; a < al.length; a++) {
      for (var b = 0; b < al.length; b++) {
        var r = al[a];
        var c = al[b];
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (var di = -2; di <= 2; di++) {
          for (var dj = -2; dj <= 2; dj++) {
            set(r + di, c + dj, Math.max(Math.abs(di), Math.abs(dj)) !== 1);
          }
        }
      }
    }

    set(size - 8, 8, true);

    for (var f = 0; f < 9; f++) { fixed[8][f] = true; fixed[f][8] = true; }
    for (var g = 0; g < 8; g++) { fixed[8][size - 1 - g] = true; fixed[size - 1 - g][8] = true; }

    if (version >= 7) {
      var vb = bchVersion(version);
      for (var v = 0; v < 18; v++) {
        var bit = ((vb >> v) & 1) === 1;
        m[Math.floor(v / 3)][v % 3 + size - 11] = bit ? 1 : 0;
        m[v % 3 + size - 11][Math.floor(v / 3)] = bit ? 1 : 0;
        fixed[Math.floor(v / 3)][v % 3 + size - 11] = true;
        fixed[v % 3 + size - 11][Math.floor(v / 3)] = true;
      }
    }
    return { m: m, fixed: fixed, size: size };
  }

  function placeData(base, bits) {
    var m = base.m;
    var fixed = base.fixed;
    var size = base.size;
    var idx = 0;
    var inc = -1;
    var row = size - 1;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (var c = 0; c < 2; c++) {
          if (!fixed[row][col - c]) {
            var dark = false;
            if (idx < bits.length) { dark = bits[idx] === 1; idx++; }
            m[row][col - c] = dark ? 1 : 0;
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }
  }

  function applyMask(m, fixed, mask) {
    var size = m.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (!fixed[r][c] && maskFn(mask, r, c)) m[r][c] ^= 1;
      }
    }
  }

  function writeFormat(m, size, mask) {
    var bits = bchFormat(mask);
    for (var i = 0; i < 15; i++) {
      var on = ((bits >> i) & 1) === 1 ? 1 : 0;
      if (i < 6) m[i][8] = on;
      else if (i < 8) m[i + 1][8] = on;
      else m[size - 15 + i][8] = on;

      if (i < 8) m[8][size - i - 1] = on;
      else if (i < 9) m[8][15 - i - 1 + 1] = on;
      else m[8][15 - i - 1] = on;
    }
    m[size - 8][8] = 1;
  }

  function penalty(m) {
    var size = m.length;
    var score = 0;
    var r, c, i;
    for (r = 0; r < size; r++) {
      var runColor = m[r][0];
      var run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === runColor) { run++; }
        else {
          if (run >= 5) score += 3 + (run - 5);
          runColor = m[r][c];
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (c = 0; c < size; c++) {
      var colColor = m[0][c];
      var colRun = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === colColor) { colRun++; }
        else {
          if (colRun >= 5) score += 3 + (colRun - 5);
          colColor = m[r][c];
          colRun = 1;
        }
      }
      if (colRun >= 5) score += 3 + (colRun - 5);
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }
    var p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(arr, at, pat) {
      for (var k = 0; k < pat.length; k++) if (arr[at + k] !== pat[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      var rowArr = m[r];
      for (c = 0; c + 11 <= size; c++) {
        if (match(rowArr, c, p1) || match(rowArr, c, p2)) score += 40;
      }
    }
    for (c = 0; c < size; c++) {
      var colArr = [];
      for (r = 0; r < size; r++) colArr.push(m[r][c]);
      for (r = 0; r + 11 <= size; r++) {
        if (match(colArr, r, p1) || match(colArr, r, p2)) score += 40;
      }
    }
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    var pct = dark * 100 / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  var lastInfo = null;

  function matrix(text, forceMask) {
    var bytes = utf8Bytes(String(text));
    var version = pickVersion(bytes.length);
    if (!version) return null;
    var data = buildData(bytes, version);
    if (!data) return null;
    var all = interleave(data, version);
    var bits = [];
    for (var i = 0; i < all.length; i++) {
      for (var b = 7; b >= 0; b--) bits.push((all[i] >> b) & 1);
    }
    var best = null;
    var bestScore = Infinity;
    var bestMask = 0;
    var masks = (typeof forceMask === 'number') ? [forceMask] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (var k = 0; k < masks.length; k++) {
      var mask = masks[k];
      var base = baseMatrix(version);
      placeData(base, bits);
      applyMask(base.m, base.fixed, mask);
      writeFormat(base.m, base.size, mask);
      var score = penalty(base.m);
      if (score < bestScore) { bestScore = score; best = base.m; bestMask = mask; }
    }
    lastInfo = { version: version, mask: bestMask, size: best ? best.length : 0, score: bestScore };
    return best;
  }

  function render(canvas, text, px) {
    var m = matrix(text);
    if (!m || !canvas) return false;
    var size = m.length;
    var quiet = 4;
    var total = size + quiet * 2;
    var scale = Math.max(1, Math.floor((px || 200) / total));
    var dim = scale * total;
    canvas.width = dim;
    canvas.height = dim;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (m[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return true;
  }

  MCW.qr = { matrix: matrix, render: render, info: function () { return lastInfo; } };
})();
