# NodeLoc Surge 每日签到模块（Cookie 版）

NodeLoc（https://www.nodeloc.com）每日签到模块：每天签到一次领**能量**奖励（官方文档：“Check-in successful! You received N Energy”，已签过显示 “You have already checked in today”；能量可用于打赏、红包、抽奖、付费内容等）。

这个版本**不用账号密码登录**，改用浏览器登录后自动抓到的 Cookie 直接调签到接口。适合密码版登录失败次数多了、服务端要求人机验证（captcha）的账号：先在浏览器里登录一次（把验证码过了），打开一次页面让模块自动抓 Cookie，之后每天自动签到，不再走登录接口，也就不会再触发登录失败的人机验证。

## 安装

1. 在 Surge 里打开模块安装链接（jsdelivr 镜像，国内能打开；如果打不开，换用 GitHub raw 链接：`https://raw.githubusercontent.com/JiuYueQingCheng/nodeloc-surge-checkin-cookie/main/nodeloc-cookie.sgmodule`）：

   ```
   https://cdn.jsdelivr.net/gh/JiuYueQingCheng/nodeloc-surge-checkin-cookie@main/nodeloc-cookie.sgmodule
   ```

2. 导入后在模块的「编辑参数」里只需要确认签到时间（默认 9 点，不用改就不用填）：

   - `checkin_hour`：每天签到小时（0-23，默认 9）
   - `checkin_minute`：每天签到分钟（0-59，默认 0）
   - `capture_cookie`：是否自动抓 Cookie（true 开，false 关，默认 true）

   例如每天 8 点 30 分签到，就填 `checkin_hour=8`、`checkin_minute=30`。`cookie` 和 `name` 不用填（模块参数里已经去掉了），Cookie 由自动捕获负责。

3. Surge 会在设定时间每天自动运行一次。想手动跑一次：Surge → 模块 → NodeLoc Cookie 签到 → 运行脚本（或在脚本页面手动触发）。

## 取 Cookie 的方法

**方法零（推荐）：自动抓——不用手动复制**

模块里带了一个 `nodeloc-cookie-capture.js`（http-request 脚本），开关是模块参数 `capture_cookie`（默认开）。开着时：

1. 在浏览器里登录 NodeLoc（登录时勾上“记住我”，Cookie 更耐用；如果弹验证码先过了）
2. 用浏览器打开一次 NodeLoc 任意页面
3. 脚本会自动把请求里的 Cookie 存下来，并弹一次“Cookie 已更新”通知，签到直接用最新抓到的

不想让它自动抓时，把 `capture_cookie` 改成 `false`，或在 Surge 脚本列表里单独关掉“NodeLoc Cookie 获取”这一项。开关开着时，自动抓到的 Cookie 会优先于 BoxJS 里手动填的 `nodeloc_cookie`（因为浏览器里刚登录过的更新）。

注意：自动抓需要 MITM（模块里已配 `www.nodeloc.com`），首次使用请按 Surge 提示安装并信任证书，否则拦截不到 HTTPS 请求，抓不到 Cookie。

如果自动抓不到（比如没装证书），再用下面手动复制的方法：

先在浏览器里登录 NodeLoc（登录时勾上“记住我”，Cookie 更耐用；如果弹验证码，先把验证码过了）。

**方法一（推荐）：开发者工具 Network**

1. 按 F12 打开开发者工具 → 切到 Network（网络）标签
2. 刷新页面
3. 点任意一个 `www.nodeloc.com` 的请求
4. 在 Request Headers 里找到 `Cookie:`，把它冒号后面的**整段值**复制下来
5. 粘贴到 BoxJS 的 `nodeloc_cookie` 里

**方法二：开发者工具 Application**

1. 按 F12 → Application（应用）→ 左侧 Cookies → `https://www.nodeloc.com`
2. 把里面的 Cookie 按 `name=value; name2=value2` 的形式拼起来
3. 粘贴到 BoxJS 的 `nodeloc_cookie` 里

注意：

- 复制时不要带 `Cookie:` 这几个字本身，脚本会自动去掉。
- Cookie 会过期（一般能用几周到几个月）。模块报“Cookie 已失效”时，在浏览器重新登录一次并打开页面（自动捕获会更新），或复制新的 Cookie 更新到 BoxJS 里。
- Cookie 等于登录态，泄露等于账号被盗用。**请勿把 Cookie 发到聊天或公开仓库**，只填在 Surge / BoxJS 本地。失效后在网站退出登录即可作废。
- Cookie 里有 `&` 请写成 `%26`（脚本会解码回来）；`=` 和 `;` 不用转义。
- 手动填 Cookie 建议直接填 BoxJS（`nodeloc_cookie`，纯文本存储，不经过 argument 解析）。

## 运行结果

| 通知标题 | 含义 |
|---|---|
| ✅ 今日签到已确认 | 签到成功，显示本次/今日奖励（+N 能量）与当前能量余额 |
| ⚠️ 签到待确认 | Cookie 有效但签到没确认，或余额查询失败——请到网站核对能量历史 |
| ❌ Cookie 已失效 | Cookie 已过期或无效——请在浏览器重新登录并打开一次页面（自动抓新 Cookie），或复制新的 Cookie 更新到 BoxJS 里 |
| 🚫 未配置 Cookie | 还没抓到 Cookie——请先在浏览器登录并打开一次 NodeLoc，或把 Cookie 填到 BoxJS 里 |

## 原理

NodeLoc 现在用的是自研 `/api/v1` 接口（按本站网页前端 `/static/app.js`、`features.js`、`auth.js` 实现，真站请求已验证），全部请求都带 Cookie 会话：

| 步骤 | 请求 |
|---|---|
| 校验 Cookie、取用户名 | `GET /api/v1/me` → `{user: {name, ...}}`；未登录返回 401 `{error: {code: "unauthorized", message: "请先登录"}}` |
| 查今日签到状态 | `GET /api/v1/checkin` → `{checked_in_today: true/false}` |
| 签到 | `POST /api/v1/checkin`（带 `Idempotency-Key` 请求头）→ `{balance, points}`，页面提示“签到成功，+N 能量” |
| 查能量余额 | `GET /api/v1/points` → `{balance, ...}` |

流程：校验 Cookie（顺便取用户名）→ 查今日签到状态 → 查能量余额 → 未签到则 POST 签到。今天已签到过时不重复 POST，直接确认。

和密码版的区别：不调 `POST /api/v1/auth/login`，所以不会因为登录失败触发人机验证，也不受两步验证影响（浏览器里登录时验证过一次就行）。

## 文件

| 文件 | 说明 |
|---|---|
| `nodeloc-cookie.js` | 签到脚本（Surge / Loon / Quantumult X / Stash 通用） |
| `nodeloc-cookie-capture.js` | 在浏览器里自动抓 Cookie 的脚本（http-request，开关是模块参数 `capture_cookie`，默认开） |
| `nodeloc-cookie.sgmodule` | Surge 模块（cron 签到 + http-request 抓 Cookie + 模块参数） |
| `README.md` | 本说明 |

## 来源

接口实现按本站网页前端代码（`/static/app.js` 的 `api()`、`features.js` 的签到逻辑、`auth.js` 的登录逻辑），并用真站请求验证了未登录时的返回格式（`GET /api/v1/me`、`GET /api/v1/checkin`、`GET /api/v1/points` 未登录都返回 401 `unauthorized`）。

## 未验证的部分（实话）

- **真实 Cookie 的完整链路**：校验、签到成功、已签到这几条分支用模拟的 `/api/v1` 响应做了测试（Cookie 有效时取用户名、签到成功 +10 能量、今天已签到过、Cookie 失效报 401），都通过了；但没有真实账号的 Cookie，无法在真站上跑通完整链路。第一次用真 Cookie 跑如果显示“待确认”，请把通知原文发我，我再改。
- **Cloudflare 拦截**：本站可能对自动化请求做 Cloudflare 拦截，脚本遇到 403 拦截页会直接报出来，这种情况模块无解，只能手动在浏览器里签到。
