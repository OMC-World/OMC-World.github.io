/* 商店页：点数商品展示（无支付集成，购买在服务器内完成） */
(function () {
  'use strict';
  var MCW = window.MCW;
  var items = [
    { name: '称号 · 地球公民', price: '5,000', desc: '聊天前缀 [地球公民]，全服可见。', tag: '外观' },
    { name: '背包扩容 +9 格', price: '12,000', desc: '个人背包从 27 格扩容到 36 格。', tag: '便利' },
    { name: '地皮扩容 +16×16', price: '20,000', desc: '主城地皮四周各扩 8 格，需在地皮内使用。', tag: '建造' },
    { name: '家园传送点 +1', price: '8,000', desc: '新增一个 /home 命名点，可随时传送。', tag: '便利' },
    { name: '小游戏入场券 ×10', price: '15,000', desc: '空岛战争 / 起床战争 / 饥饿游戏通用。', tag: '小游戏' },
    { name: '限定披风 · 极光', price: '30,000', desc: '客户端可见的披风外观，仅本服生效。', tag: '外观' }
  ];

  function render() {
    var grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = items.map(function (it, i) {
      return '<article class="card shop-card">' +
        '<div class="shop-head"><h3 style="margin:0">' + MCW.esc(it.name) + '</h3><span class="badge badge-mute">' + MCW.esc(it.tag) + '</span></div>' +
        '<p>' + MCW.esc(it.desc) + '</p>' +
        '<div class="kv"><span>价格</span><span class="price">' + MCW.esc(it.price) + ' 点数</span></div>' +
        '<button class="btn btn-sm" type="button" data-buy="' + i + '">查看购买方式</button>' +
        '</article>';
    }).join('');
    grid.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-buy]') : null;
      if (!btn) return;
      var it = items[Number(btn.getAttribute('data-buy'))];
      MCW.toast('请在服务器内执行 /shop 购买「' + (it ? it.name : '') + '」，本页不处理支付。', 'ok');
    });
  }

  MCW.ready(render);
})();
