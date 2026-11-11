# OMC World 网页端

静态站点：零构建、零第三方依赖、无 CDN。GitHub Pages 直接发布仓库根目录。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 实时状态：在线人数采样折线、TPS、服务器信息、入口卡片、连接地址 |
| `stocks.html` | 股票列表、详情折线、买入/卖出下单 |
| `market.html` | 物品行情与单品走势 |
| `play.html` | 连接地址、版本、账号登录 / 两步验证 / MC 绑定 / 我的订单 |
| `rules.html` | 玩家规则（八条） |
| `404.html` | 页面不存在 |

已删除的旧页面（`shop.html`、`account.html`、`servers.html`、`connect.html`）由 404 页承接。

## 数据来源

所有数字来自服务端公开接口，页面每 5 秒轮询；断线时保留最后一次成功数据并标注断线时间。
公网连接地址由 `address.js` 首屏请求 `/api/status` 的 `serverAddress` 并每 15 秒自愈；登录后 `/api/link/start` 返回的地址优先覆盖。
接口未配置或不可达时显示「服务端未连接」，不做任何本地兜底数据。

`config.js`：

```js
window.MCW_CONFIG = {
  api: "",            // 服务端基址，例如 https://api.example.com；留空 = 未连接
  port: 25565,
  version: "1.21.11 ~ 26.3", // 连接块展示的最低版本；具体版本号取自 /api/status
  accountUrl: "",     // 账号绑定页；留空 = 按钮显示「暂未开放」
  pollMs: 5000
};
```

调试时可用 `?api=https://...` 临时覆盖（写入 sessionStorage）。

## 接口契约

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | `{ok, ts, version}` |
| GET | `/api/status` | `{ok, ts, motd, version, online, max, players[], tps, uptimeSec, world{name,day}, serverAddress}` |
| GET | `/api/market` | `{ok, ts, items[{id,name,price,change24h,volume,buyers,sellers,history[{t,p}]}]}` |
| GET | `/api/stocks` | `{ok, ts, stocks[{symbol,name,sector,price,change24h,volume,marketCap,history,holders}]}` |
| GET | `/api/stocks/<symbol>` | 单只股票 + `depth{bids,asks}`（页面不使用深度） |
| POST | `/api/stocks/trade` | `{symbol, side:'buy'|'sell', qty, linkCode}` → `{ok, filled, price, total, balance}` |
| GET | `/api/plots` | `{ok, ts, plots[]}`（预留，页面暂未使用） |
| POST | `/api/auth/register` | `{email,password}` → `{ok,userId}`；注册不建会话 |
| POST | `/api/auth/login` | `{email,password}` → `{ok,userId,token,expiresIn}` + `omc_session` cookie；开启 2FA 的账号返回 `{twoFactorRequired:true,challengeId,expiresIn}` |
| POST | `/api/login/2fa` | `{challengeId,code}` → 建会话；`code` 为 6 位 TOTP 或恢复码 |
| GET | `/api/me` | `{ok,user{...twoFactor,recoveryCodesLeft}}` |
| POST | `/api/logout` | 清除会话 |
| POST | `/api/2fa/setup` | 需会话 → `{secret,otpauthUrl}`；已启用 409 `already_enabled` |
| POST | `/api/2fa/enable` | `{code}` → `{recoveryCodes:[10]}`，明文只出现一次 |
| POST | `/api/2fa/disable` | `{code}` 或 `{password}` → `{ok}` |
| GET | `/api/link/start` | 需会话 → 6 位绑定码与 `serverAddress` |
| GET | `/api/orders/mine` | 需会话 → `{items[]}` |

错误统一为 `{ok:false, error:{code, message}}`，页面直接展示 `message`。

`/api/me` 的 `twoFactor` 在 `user` 内；恢复码只在 `/api/2fa/enable` 响应中明文返回一次，页面关闭后不再展示。

## 本地预览

```
node tools/serve.js 8080
```

打开 http://127.0.0.1:8080/ 。未配置 `api` 时页面显示「服务端未连接」，属预期。

## 自检

```
node tools/check.js
```

覆盖：必需文件、真实 HTTP 200/404、资源引用与零外链、JS 语法、UTF-8 无 BOM、禁用词与系统弹窗、接口契约锚点、vm 运行时（stub fetch 下折线 path、下单校验、断线保留旧数据、`/api/status` 地址与版本渲染）。全部通过时输出 `RESULT pass=N fail=0`。

## 部署

仓库根即站点根，已含 `.nojekyll`；无构建步骤。推送仓库根到 Pages 源分支即可。
