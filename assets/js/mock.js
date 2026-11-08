/* MC-World 离线演示数据（API 不可达时使用，保证页面不白屏） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  var servers = [
    { id: 1, role: 'login', name: '登录服 #1', online: 0, max: 200, players: [], tps: 20.0, latency: 36, status: 'online' },
    { id: 2, role: 'main', name: '主服 #2 · 地球Online', online: 87, max: 120, players: [], tps: 19.8, latency: 42, status: 'online' },
    { id: 3, role: 'game', name: '游戏服 #3 · 空岛战争', online: 23, max: 40, players: [], tps: 20.0, latency: 45, status: 'online' },
    { id: 4, role: 'game', name: '游戏服 #4 · 起床战争', online: 31, max: 40, players: [], tps: 19.6, latency: 47, status: 'online' },
    { id: 5, role: 'game', name: '游戏服 #5 · 跑酷竞速', online: 0, max: 30, players: [], tps: 0, latency: 0, status: 'offline' },
    { id: 6, role: 'game', name: '游戏服 #6 · 饥饿游戏', online: 12, max: 30, players: [], tps: 19.9, latency: 51, status: 'online' },
    { id: 1025, role: 'mirror', name: '镜像服 #1025', online: 14, max: 80, players: [], tps: 20.0, latency: 60, status: 'online' },
    { id: 1026, role: 'mirror', name: '镜像服 #1026', online: 0, max: 80, players: [], tps: 0, latency: 0, status: 'maintenance' }
  ];

  var list = [
    { id: 1, role: 'login', port: 25565, host: 'play.mc-world.example', name: '登录服 #1', desc: '唯一对外入口，Velocity 代理 + 认证/注册，完成后自动重定向' },
    { id: 2, role: 'main', port: 25566, host: '127.0.0.1', name: '主服 #2', desc: '预定地图、经济、地皮、持久化存档' },
    { id: 3, role: 'game', port: 25567, host: '127.0.0.1', name: '游戏服池 #3–#1024', desc: '小游戏实例池，按需启动、空服回收' },
    { id: 1025, role: 'mirror', port: 26589, host: '127.0.0.1', name: '镜像服 #1025–#1030', desc: '只读镜像，定期拉取主服状态，用于分流与展示' }
  ];

  MCW.mock = {
    status: function () {
      return { ok: true, servers: servers, updatedAt: new Date().toISOString() };
    },
    servers: function () {
      return { ok: true, servers: list, updatedAt: new Date().toISOString() };
    }
  };
})();
