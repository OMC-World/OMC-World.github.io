/* ============================================================
 * MC-World 网页端配置
 * ------------------------------------------------------------
 * 部署时只需要改这一个文件（或部署脚本替换这一行）：
 *   把 <account> 替换成你的 Cloudflare 账号子域。
 *
 * 若保留占位符（含 "<"）或留空，前端会自动进入「演示模式」：
 * 用内置 mock 数据渲染页面，不会白屏、不会报错。
 * 前端永远不持有任何密钥。
 * ============================================================ */
window.MCWORLD_API = "https://mc-world-api.<account>.workers.dev";

/* 对外连接地址（Cloudflare Tunnel 指向的 Velocity 登录服） */
window.MCWORLD_HOST = "play.mc-world.example";
window.MCWORLD_PORT = 25565;

/* 客户端版本要求（仅展示用） */
window.MCWORLD_VERSION = "1.21.11 及以上（Fabric / Forge / NeoForge / 原版）";
