# MC-World 网页端（GitHub Pages 静态站）

纯静态、零构建、零密钥。所有资源使用相对路径，**站点根 = 本目录内容**，可直接挂在 GitHub Pages 的 `/mc-world/` 子路径下而不 404。

- 主页 / 玩法 / 服务器状态 / 连接指引 / 账号 / 规则 / 商店，共 7 个页面 + 404
- 深色主题、响应式、全中文
- API 不可达时自动使用内置 mock 数据渲染，**绝不白屏**
- 前端不持有任何密钥，token 仅保存在浏览器 localStorage

## 目录结构

```
web/
├─ index.html          主页（简介 / 状态摘要 / 六币种经济 / 新用户福利）
├─ play.html           玩法介绍（小游戏 / 和平生存 / 规则服 / 预定地图）
├─ servers.html        服务器列表 + 实时状态（/api/status、/api/servers）
├─ connect.html        连接指引 + API 契约 + 连通性自检
├─ account.html        注册 / 登录（/api/auth/*）
├─ rules.html          服务器规则 + 地皮命令（/player new、/item、/function）
├─ shop.html           点数商店（展示，无支付）
├─ 404.html            404 页
├─ config.js           window.MCWORLD_API / HOST / PORT（唯一需要改的配置）
├─ favicon.svg         站点图标
├─ robots.txt          爬虫规则
├─ .nojekyll           关闭 Jekyll，保证下划线文件可发布
├─ assets/
│  ├─ css/style.css    全站样式
│  └─ js/
│     ├─ util.js       工具函数（转义 / 时间 / toast / 复制 / 标签页）
│     ├─ mock.js       离线演示数据
│     ├─ api.js        API 客户端（超时、降级、token 存取、契约表）
│     ├─ nav.js        全站导航：状态灯、登录态、标签页、复制按钮
│     ├─ home.js       首页状态摘要
│     ├─ servers.js    服务器列表渲染 / 过滤 / 30s 轮询
│     ├─ account.js    注册登录表单与会话
│     ├─ shop.js       商店渲染
│     └─ connect.js    连接页：地址、契约、自检
├─ tools/
│  ├─ check.js         静态自检（起本地服务器 + 抓页面 + 404 检测 + 落盘）
│  └─ serve.js         本地预览服务器
└─ README.md
```

## 本地预览

任选一种（都在本目录执行）：

```bash
node tools/serve.js 8080
```

```bash
python -m http.server 8080
```

然后打开 <http://127.0.0.1:8080/>。

> 不要直接双击 HTML 用 `file://` 打开：`fetch` 在 file 协议下会被浏览器拦截，页面会退回演示数据（仍可浏览，但看不到真实状态）。

## 部署到 GitHub Pages

1. **仓库根 = 本目录内容**：`index.html` 必须在仓库根，而不是 `web/` 子目录（否则路径整体错位）。
2. 确认 `.nojekyll` 在根目录（本目录已带）。
3. 仓库 → Settings → Pages → Source 选 **Deploy from a branch** → 分支 `main`、目录 `/(root)` → Save。
4. 等 Actions 完成，访问 `https://<用户名>.github.io/<仓库名>/`。
5. 因为所有链接都是 `./assets/...` 形式，**不需要**改 base path，也不需要构建。

当前目标仓库：`zssx-2026/mc-world`，预期地址 `https://zssx-2026.github.io/mc-world/`。

## 替换 API 地址

编辑 `config.js`，只改这一行：

```js
window.MCWORLD_API = "https://mc-world-api.<account>.workers.dev";
```

把 `<account>` 换成 Cloudflare 账号子域即可。同时可改对外连接地址：

```js
window.MCWORLD_HOST = "play.mc-world.example";
window.MCWORLD_PORT = 25565;
```

临时调试（不改文件）：在任意页面 URL 后加 `?api=https://你的-worker.workers.dev`，覆盖值写入 sessionStorage，仅当前标签页有效。

**演示模式判定**：地址为空、含 `<` 占位符、或含 `example.com` 时，前端判定为未配置，直接走内置 mock，并在页面显示「演示模式 / 离线演示」标记。

## 离线降级策略

| 场景 | 表现 |
|---|---|
| 未配置 API | 页面用 `assets/js/mock.js` 渲染，状态标记「演示模式」 |
| API 超时 / 网络错误 | 5 秒超时后降级，状态标记「离线演示」，不弹窗、不白屏 |
| API 返回 4xx/5xx | 同上，按离线处理 |
| API 正常 | 状态标记「实时数据」，服务器页每 30 秒轮询一次 |

注册/登录在演示模式下仅写入本机 localStorage，并在表单与账号页明确标注「演示模式」，不会伪造真实账号。

## 自检

```bash
node tools/check.js
```

脚本会：

1. 在 `127.0.0.1:0` 起一个真实静态服务器；
2. 逐个请求 8 个页面，断言 HTTP 200、Content-Type、`<!DOCTYPE html>`、`lang="zh-CN"`、charset、viewport、title、样式与脚本引用；
3. 解析每个页面的所有 `src`/`href`，断言本地资源全部 200（**404 检测**）、无根绝对路径、无外部网络依赖；
4. 用 `vm.Script` 编译所有 JS（只编译不执行）验证语法；
5. 检查 BOM 与 UTF-8 合法性；
6. 检查无 `alert/confirm/prompt`、无内联事件；
7. 检查 API 契约端点与 mock 数据是否实现；
8. 结果打印到终端并落盘 `tools/check-result.txt`，失败时进程退出码为 1。

## API 契约（与 Worker 团队对齐）

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/api/status` | — | `{ok:true, servers:[{id,role,name,online,max,players,tps,latency,status}], updatedAt}` |
| GET | `/api/servers` | — | `{ok:true, servers:[{id,role,port,host,name,desc}]}` |
| POST | `/api/auth/register` | `{username,password}` | `{ok:true,token}` 或 `{ok:false,error}` |
| POST | `/api/auth/login` | `{username,password}` | `{ok:true,token}` 或 `{ok:false,error}` |
| GET | `/api/redirect?player=x` | — | `{ok:true,server:{id,host,port}}` |

前端对 `status` 字段的取值约定：`online` / `offline` / `maintenance` / `full`；`role` 取 `login` / `main` / `game` / `mirror`。`online` 为在线人数；`players` 兼容「玩家名数组」或数字，二者都可用于展示。

## 设计约定

- **不弹窗**：所有提示走页面内联消息或右下角 toast，不用 `alert/confirm/prompt`。
- **零外部依赖**：不引用 CDN、字体、图标库，断网也能完整渲染。
- **相对路径**：全部 `./assets/...`，适配 Pages 子路径。
- **UTF-8 无 BOM**：所有文件由检查脚本校验。
- **可访问性**：语义化标签、`aria-label`、可见焦点环、`prefers-reduced-motion` 降级。

## 已知限制

- `config.js` 中的 `MCWORLD_HOST` 仍是占位域名，正式上线前需替换为 Cloudflare Tunnel 的实际域名。
- 商店页只做展示与价格换算，不接支付；真实购买在服务器内 `/shop` 完成。
- 状态刷新为 30 秒轮询，未接 WebSocket/SSE；人数变化有最多 30 秒延迟。
- 演示模式下的注册/登录不产生真实账号，仅用于验证前端流程。
- 账号页不做验证码与找回密码流程，这两项需 Worker 侧提供端点后再接入。
