/* OMC World 前端配置：部署时只改这里 */
window.MCW_CONFIG = {
  /* 实时数据服务基址（Cloudflare Pages Functions）；留空 = 未连接 */
  api: "https://omc-world.pages.dev",
  /* 公网连接地址；留空 = 入口尚未开通，页面显示「待开通」而不是假地址 */
  host: "",
  port: 25565,
  /* 服务器支持的最低版本（ViaVersion 协议翻译，1.21.11 ~ 26.3 都能进） */
  version: "1.21.11",
  /* 账号页地址；留空 = 暂未开放 */
  accountUrl: "",
  /* 轮询间隔（毫秒） */
  pollMs: 5000
};
