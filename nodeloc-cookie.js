/**
 * NodeLoc · 每日签到（Cookie 版），领取能量奖励
 *
 * 目标站：https://www.nodeloc.com
 * （官方文档见 https://docs.nodeloc.com/energy/checkin ：签到按钮在页面
 *  右上角，每天可签一次，签到成功提示 “Check-in successful! You received
 *  N Energy”，已签过显示 “You have already checked in today”。）
 *
 * 这个版本不用账号密码登录，改用浏览器登录后复制的 Cookie 直接调签到接口。
 * 适合密码版登录失败次数多了、服务端要求人机验证（captcha）的账号：
 * 先在浏览器里登录一次（把验证码过了），复制 Cookie 填进模块参数，
 * 之后每天自动签到，不再走登录接口，也就不会再触发登录失败的人机验证。
 *
 * 原理（按本站网页前端自己的代码，即 /static/app.js 的 api() 与
 *  /static/features.js 的签到逻辑；已用真站请求验证）：
 *   GET  /api/v1/me
 *     -> {user: {name, ...}}，用来校验 Cookie 是否有效、取用户名。
 *        未登录返回 401 {error: {code: "unauthorized", message: "请先登录"}}
 *   GET  /api/v1/checkin
 *     -> {checked_in_today: true/false}
 *   POST /api/v1/checkin（带 Idempotency-Key 请求头）
 *     -> {balance, points}，页面提示 “签到成功，+N 能量”
 *   GET  /api/v1/points
 *     -> {balance, ...} 当前能量余额
 *   全部请求都带 Cookie 会话（本站用 Cookie 认证，credentials: "same-origin"）。
 *
 * 取 Cookie 的方法（浏览器里先登录 NodeLoc，登录时勾上“记住我”，Cookie 更耐用）：
 *   方法一（推荐）：按 F12 打开开发者工具 → Network（网络）→ 刷新页面 →
 *     点任意一个 www.nodeloc.com 的请求 → Request Headers 里找到 Cookie:，
 *     把它冒号后面的整段值复制下来。
 *   方法二：F12 → Application（应用）→ Cookies → https://www.nodeloc.com →
 *     把里面的 Cookie 按 name=value; name2=value2 的形式拼起来。
 *   复制时不要带 “Cookie:” 这几个字本身，脚本会自动去掉；也不要只复制
 *   __cf_bm 这类 Cloudflare 的 Cookie，要包含登录会话那一个。
 *   Cookie 会过期（一般能用几周到几个月）。模块报 “Cookie 已失效” 时，
 *   在浏览器重新登录一次，再复制新的 Cookie 更新到模块参数里。
 *
 * 注意：本站可能有 Cloudflare 拦截，Surge 请求若被拦截会直接报出来，
 * 这种情况模块无解，只能手动在浏览器里签到。
 *
 * Cookie 填写（四选一，优先 $argument；另见自动捕获）：
 *   0. 自动捕获（推荐，不用手动复制）：模块里还有一个 nodeloc-cookie-capture.js
 *     （http-request 脚本），开关是模块参数 capture_cookie（默认开）。
 *      开着时，用浏览器打开一次 NodeLoc（登录状态），脚本会自动把请求里的
 *      Cookie 存下来，签到直接用最新抓到的；手动填的 cookie 参数会被它覆盖。
 *      不想让它自动抓时，把 capture_cookie 改成 false，或在 Surge 脚本列表里
 *      单独关掉“NodeLoc Cookie 获取”这一项。
 *   1. Surge 模块参数（手动）：nodeloc-cookie.sgmodule 里用 #!arguments 声明了
 *      cookie、name，导入模块后在 Surge「编辑参数」里填写。
 *      Cookie 里有 & 请写成 %26（脚本会解码回来）；= 和 ; 不用转义。
 *   2. Surge 脚本的 argument 参数（字符串）：
 *        argument=cookie=你的Cookie&name=备注（可选）
 *      或 JSON：
 *        argument={"cookie":"你的Cookie","name":"备注"}
 *      多账号 JSON：
 *        argument={"accounts":[{"name":"a","cookie":"..."},{"name":"b","cookie":"..."}]}
 *   3. BoxJS / $persistentStore：
 *        nodeloc_cookie、nodeloc_cookie_name
 *      多账号时在 BoxJS 填 nodeloc_cookie_accounts（JSON 数组，同上格式）。
 *   Cookie 很长，填在模块参数里最方便；如果含特殊字符导致解析失败，
 *   改填 BoxJS（纯文本存储，不经过 argument 解析）。
 *
 * 请勿把 Cookie 发到聊天或公开仓库，只填在 Surge / BoxJS 本地。
 * Cookie 等于登录态，泄露等于账号被盗用；失效后在网站退出登录即可作废。
 *
 * 签到：cron 每天在模块参数设定的时间自动运行（默认 09:00）。
 * 时间在 nodeloc-cookie.sgmodule 的「编辑参数」里改：checkin_hour（0-23，默认 9）、
 * checkin_minute（0-59，默认 0），例如 8 点 30 分就填 8 和 30。结果未确认时请到网站核对。
 *
 * 接口来源：本站网页前端 /static/app.js、/static/features.js、/static/auth.js
 * 本版作者：Muse，Surge / Loon / Quantumult X / Stash 通用脚本。
 *
 * ===== Surge =====
 * [Script]
 * NodeLoc Cookie签到 = type=cron,cronexp="0 9 * * *",timeout=60,script-path=https://raw.githubusercontent.com/JiuYueQingCheng/nodeloc-surge-checkin-cookie/main/nodeloc-cookie.js,argument=cookie=你的Cookie&name=备注
 * 也可以直接用随附的 nodeloc-cookie.sgmodule 导入 Surge（见 README.md）。
 *
 * ===== Loon / Quantumult X / Stash =====
 * Loon 的 $argument 是对象，Quantumult X / Stash 用 BoxJS 填 Cookie，
 * 其余用法与密码版模块相同。
 */

const $ = new Env("NodeLoc Cookie");

// 签到合集开启「统一通知」时不单独弹通知，结果由签到汇总统一发送
$.merge = typeof $argument === "object" && !!$argument && $argument.merge === true;

if ($.merge) $.msg = (...a) => console.log(a.filter((x) => typeof x === "string" && x).join("\n"));

const SCRIPT_VERSION = "2026-11-26.r2";

$.log(`[INFO] 脚本版本 ${SCRIPT_VERSION}`);

const COOKIE_KEY = "nodeloc_cookie";
const NAME_KEY = "nodeloc_cookie_name";
const ACCOUNTS_KEY = "nodeloc_cookie_accounts";
const CLEAR_KEY = "nodeloc_cookie_clear";
const DEBUG_KEY = "nodeloc_cookie_debug";
const STATUS_KEY = "nodeloc_cookie_status";
// 捕获开关：模块参数 capture_cookie（true/false），或 BoxJS 的 nodeloc_cookie_capture。
const CAPTURE_KEY = "nodeloc_cookie_capture";

const IS_LOON = $.isLoon();

// $argument 在 Surge 里是字符串，在 Loon 里是对象，在 QX/Stash 里不存在。
// 统一解析成对象，解析失败时当作空对象。
const PLUGIN = parseArgument(typeof $argument !== "undefined" ? $argument : null);

const SETTINGS_PAGE = IS_LOON ? "Loon 插件设置或 BoxJS" : "BoxJS / Surge 模块 argument";

const BASE_URL = "https://www.nodeloc.com";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

// 当前账号的 Cookie（用户从浏览器复制的完整 Cookie 请求头值）。
// 每个账号单独设置，不沿用到下一个账号。
let currentCookie = "";

function parseArgument(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return {};
    const text = raw.trim();
    if (!text) return {};
    // JSON：{"cookie":"...","name":"..."} 或 {"accounts":[...]}
    if (text.startsWith("{")) {
        try { return JSON.parse(text); } catch (_) { return {}; }
    }
    // 查询串：cookie=...&name=...&debug=true
    const out = {};
    for (const part of text.split("&")) {
        const eq = part.indexOf("=");
        if (eq <= 0) continue;
        const k = decodeURIComponent(part.slice(0, eq).trim());
        const v = decodeURIComponent(part.slice(eq + 1).trim());
        if (k) out[k] = v;
    }
    return out;
}

// 捕获开关是否打开：模块参数 capture_cookie（true/false），
// 或 BoxJS 的 nodeloc_cookie_capture；都没填时默认开。
function isCaptureOn() {
    const raw = (PLUGIN.capture_cookie !== undefined && PLUGIN.capture_cookie !== null)
        ? PLUGIN.capture_cookie
        : $.getdata(CAPTURE_KEY);
    if (raw === undefined || raw === null || raw === "") return true;
    if (typeof raw === "boolean") return raw;
    return !/^(false|0|off|no)$/i.test(String(raw).trim());
}

// 清理用户粘贴的 Cookie：去首尾空白、去掉 “Cookie:” 前缀、去掉包围的引号。
function normalizeCookie(raw) {
    if (typeof raw !== "string") return "";
    let s = raw.trim();
    if (!s) return "";
    s = s.replace(/^cookie\s*:\s*/i, "").trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

run().catch((error) => {
    // 只输出脚本主动生成的错误，不转储 Cookie、请求和原始响应。
    saveStatus("fail", error.message);
    $.msg($.name, "❌ 运行失败", error.message);
}).finally(() => $.done());

async function run() {
    const clear = $.getdata(CLEAR_KEY);

    if (clear === "true" || clear === "1") {
        const cookieCleared = $.setdata("", COOKIE_KEY);
        const nameCleared = $.setdata("", NAME_KEY);
        if (!cookieCleared || !nameCleared) {
            throw new Error("Cookie 清除失败，请在 BoxJS 中检查并手动清空");
        }
        $.setdata("false", CLEAR_KEY);
        $.msg($.name, "✅ Cookie 已清除", "需要继续签到时，请在 BoxJS 重新填写 Cookie");
        return;
    }

    const accounts = readAccounts();

    if (!accounts.length) {
        saveStatus("none", "未配置 Cookie");
        $.msg($.name, "🚫 未配置 Cookie", `请先在浏览器登录 NodeLoc 并复制 Cookie，再填到 ${SETTINGS_PAGE} 的 NodeLoc Cookie 里`);
        return;
    }

    const results = [];

    for (let i = 0; i < accounts.length; i++) {
        debug(`开始账号 ${i + 1}/${accounts.length}`);
        try {
            results.push(await checkin(accounts[i]));
        } catch (error) {
            results.push({ title: "❌ 运行失败", content: error.message });
        }
    }

    // Cookie 失效 = 需要重新抓取，对应体检里的「需重新抓取」
    const cookieExpired = results.some((result) => result.title === "❌ Cookie 已失效");
    const failed = results.find((result) => result.title === "❌ 运行失败");

    if (cookieExpired) saveStatus("cookie", "Cookie 已失效,请重新登录后复制新 Cookie");
    else if (failed) saveStatus("fail", failed.content);
    else saveStatus("ok", results.map((result) => result.content.split("\n")[0].replace(/^🎁\s*/, "")).join(" · "), results.length === 1 ? results[0].balance : undefined); // 多账号不合并余额

    if (results.length === 1) {
        $.msg($.name, results[0].title, `👤 账号：${maskAccount(results[0].label || accounts[0].name || "")}\n${results[0].content}`);
    } else {
        $.msg($.name, `签到汇总（${results.length} 个账号）`, results.map((result, i) =>
            `👤 账号 ${i + 1} · ${maskAccount(result.label || accounts[i].name || "")}\n${result.title}\n${result.content}`).join("\n\n"));
    }
}

function readAccounts() {
    // 1. $argument（Surge 字符串 / Loon 对象）里的多账号
    const multi = PLUGIN.accounts;
    if (multi) {
        let accounts;
        if (typeof multi === "string") {
            try { accounts = JSON.parse(multi); } catch (_) {
                throw new Error("多账号格式错误，请按使用说明填写 JSON 数组");
            }
        } else {
            accounts = multi;
        }
        if (!Array.isArray(accounts) || !accounts.length) {
            throw new Error("多账号必须是非空 JSON 数组；使用单账号时请清空多账号输入框");
        }
        return accounts.map((account, i) => {
            const cookie = normalizeCookie(account && account.cookie);
            if (!account || !cookie) {
                throw new Error(`多账号第 ${i + 1} 项缺少有效的 cookie，请检查插件设置`);
            }
            return { name: typeof account.name === "string" ? account.name.trim() : "", cookie };
        });
    }

    // 2. BoxJS 里存的多账号
    const storedMulti = $.getdata(ACCOUNTS_KEY);
    if (storedMulti) {
        try {
            const accounts = JSON.parse(storedMulti);
            if (Array.isArray(accounts) && accounts.length) {
                return accounts.map((account, i) => {
                    const cookie = normalizeCookie(account && account.cookie);
                    if (!account || !cookie) {
                        throw new Error(`多账号第 ${i + 1} 项缺少有效的 cookie`);
                    }
                    return { name: typeof account.name === "string" ? account.name.trim() : "", cookie };
                });
            }
        } catch (e) {
            if (e.message && e.message.includes("多账号第")) throw e;
            throw new Error("BoxJS 多账号格式错误，请填写 JSON 数组");
        }
    }

    // 3. 单账号
    const argCookie = normalizeCookie(PLUGIN.cookie || "");
    const storeCookie = normalizeCookie($.getdata(COOKIE_KEY) || "");
    const name = (PLUGIN.name || $.getdata(NAME_KEY) || "").trim();
    // 捕获开关开着时，优先用捕获脚本存在 $persistentStore 里的最新 Cookie
    //（浏览器里刚登录过的，比模块参数里手动填的旧 Cookie 新）；
    // 开关关着时沿用老顺序：模块参数优先，其次 $persistentStore。
    const cookie = (isCaptureOn() && storeCookie) ? storeCookie : (argCookie || storeCookie);

    return cookie ? [{ name, cookie }] : [];
}

function uuid() {
    // Math.random 版 UUID v4，不依赖 crypto 接口。
    const hex = "0123456789abcdef";
    const pick = () => hex[Math.floor(Math.random() * 16)];
    let s = "";
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
        else if (i === 14) s += "4";
        else if (i === 19) s += hex[8 + Math.floor(Math.random() * 4)];
        else s += pick();
    }
    return s;
}

function apiHeaders(extra) {
    const headers = {
        "User-Agent": UA,
        Accept: "application/json",
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
    };
    // Cookie 是用户提供的，直接原样发送（所有平台都一样，不依赖自动管理）。
    if (currentCookie) headers["Cookie"] = currentCookie;
    return Object.assign(headers, extra || {});
}

function apiError(data) {
    if (!data || typeof data !== "object") return { code: "", message: "" };
    const err = data.error && typeof data.error === "object" ? data.error : data;
    return {
        code: typeof err.code === "string" ? err.code : "",
        message: typeof err.message === "string" ? err.message : (typeof data.message === "string" ? data.message : ""),
    };
}

// Cookie 失效时的统一提示（401 unauthorized）
function cookieExpiredResult() {
    return {
        title: "❌ Cookie 已失效",
        content: `Cookie 已过期或无效，请在浏览器重新登录 NodeLoc（登录时勾上“记住我”），再把新的 Cookie 复制到 ${SETTINGS_PAGE} 里`,
    };
}

async function checkin({ name, cookie }) {
    currentCookie = cookie;
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

    // 1. 用 Cookie 调 /api/v1/me：校验 Cookie 是否有效，顺便取用户名
    let me;
    try {
        me = await request("GET", "/api/v1/me", apiHeaders(), undefined, "账号校验");
    } catch (error) {
        return { title: "⚠️ 签到待确认", content: `🎁 签到奖励：待确认\n\n账号校验失败\n${error.message}`, label: name };
    }

    if (me.status === 401 || (me.json && me.json.error && apiError(me.json).code === "unauthorized")) {
        return Object.assign(cookieExpiredResult(), { label: name });
    }
    if (me.status >= 400 || (me.json && me.json.error)) {
        const err = apiError(me.json);
        return { title: "⚠️ 签到待确认", content: `🎁 签到奖励：待确认\n\n账号校验失败：${err.message || "请到网站核对"}`, label: name };
    }

    const username = (me.json && me.json.user && typeof me.json.user.name === "string" && me.json.user.name.trim())
        ? me.json.user.name.trim()
        : name;
    debug(`账号校验成功；用户：${username || "（未取到）"}`);

    // 2. 查今日签到状态
    let statusRes;
    try {
        statusRes = await request("GET", "/api/v1/checkin", apiHeaders(), undefined, "签到状态查询");
    } catch (error) {
        return { title: "⚠️ 签到待确认", content: `🎁 签到奖励：待确认\n\n签到状态查询失败\n${error.message}`, label: username };
    }

    if (statusRes.status === 401 || (statusRes.json && statusRes.json.error && apiError(statusRes.json).code === "unauthorized")) {
        return Object.assign(cookieExpiredResult(), { label: username });
    }

    // 3. 查能量余额（失败不拦签到）
    let balance;
    let stats = "";
    try {
        const points = await request("GET", "/api/v1/points", apiHeaders(), undefined, "能量查询");
        if (points.json && typeof points.json.balance === "number" && Number.isFinite(points.json.balance)) {
            balance = `能量 ${points.json.balance}`;
            stats = `⚡ 当前能量：${points.json.balance}`;
        }
    } catch (error) {
        debug(`能量查询失败：${error.message}`);
    }

    if (statusRes.json && statusRes.json.checked_in_today === true) {
        return { title: "✅ 今日签到已确认", content: `🎁 今日奖励：今日已签到\n${stats}\n🕒 签到日期：${today}（今日已签到）`, balance, label: username };
    }

    // 4. 未签到：POST 签到
    let doRes;
    try {
        doRes = await request("POST", "/api/v1/checkin",
            apiHeaders({ "Idempotency-Key": uuid() }),
            undefined,
            "签到");
    } catch (error) {
        return { title: "⚠️ 签到待确认", content: `🎁 签到奖励：待确认\n${stats}\n\n签到请求失败\n${error.message}`, balance, label: username };
    }

    if (doRes.status === 401 || (doRes.json && doRes.json.error && apiError(doRes.json).code === "unauthorized")) {
        return Object.assign(cookieExpiredResult(), { label: username });
    }

    if (doRes.status >= 400 || (doRes.json && doRes.json.error)) {
        const err = apiError(doRes.json);
        if (/already checked in|已经签到|今日已签/i.test(`${err.code} ${err.message}`)) {
            return { title: "✅ 今日签到已确认", content: `🎁 今日奖励：今日已签到\n${stats}\n🕒 签到日期：${today}（今日已签到）`, balance, label: username };
        }
        return { title: "⚠️ 签到待确认", content: `🎁 签到奖励：待确认\n${stats}\n\n签到未成功：${err.message || "请到网站核对"}`, balance, label: username };
    }

    const points = doRes.json && typeof doRes.json.points === "number" ? doRes.json.points : null;
    const newBalance = doRes.json && typeof doRes.json.balance === "number" ? doRes.json.balance : null;
    if (newBalance !== null) {
        balance = `能量 ${newBalance}`;
        stats = `⚡ 当前能量：${newBalance}`;
    }
    const reward = points !== null
        ? `🎁 本次奖励：+${points} 能量`
        : "🎁 本次奖励：签到成功（金额未识别，请到网站核对）";
    return { title: "✅ 今日签到已确认", content: `${reward}\n${stats}\n🕒 签到日期：${today}`, balance, label: username };
}

// 记录本次结果，供「签到汇总」：ok 正常 / cookie 需重新抓取 / fail 其他失败 / none 未使用
function saveStatus(s, msg, asset) {
    msg = String(msg).slice(0, 100);

    // 服务器明确提示登录过期的失败，按需要重新抓取处理
    if (s === "fail" && /过期|重新登录|未登录|请登录|登录失效|登录已失效|token\s*(失效|过期|无效)|not\s*login/i.test(msg)) s = "cookie";

    // 同一天已有带奖励的成功记录时，再次运行得到的「今日已签」不覆盖它的奖励文字，只合并本次的资产等信息
    let keep = null;

    if (s === "ok" && /^今日已/.test(msg)) {
        const day = (t) => new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10);
        let old = null;
        try { old = JSON.parse($.getdata(STATUS_KEY) || "null"); } catch (e) {}
        if (old && old.s === "ok" && !/^今日已/.test(old.msg) && day(old.t) === day(Date.now())) keep = old;
    }

    checkinReport(STATUS_KEY, keep ? keepReward(keep, { s, msg, asset }) : { s, msg, asset }, { name: "NodeLoc Cookie", author: "Muse" });
}

function maskAccount(label) {
    if (!label) return "未命名";
    const name = String(label).split("@")[0];
    return name.length > 4 ? `${name.slice(0, 2)}***${name.slice(-2)}` : `${name.slice(0, 1)}***`;
}

function request(method, path, headers, body, label) {
    return new Promise((resolve, reject) => {
        const options = { url: BASE_URL + path, headers };
        if (body !== undefined) options.body = body;

        // Cookie 只发给固定 HTTPS 站点；Loon 默认允许不受信任证书，需显式关闭。
        if ($.isLoon()) {
            options.insecure = false;
            options["auto-redirect"] = false;
            // 每个账号只使用本次提供的 Cookie，禁止 Cookie 自动沿用到下一个账号。
            options["auto-cookie"] = false;
        }

        $.send(options, method, (error, response, text) => {
            if (error) {
                reject(new Error(`${label}网络请求失败，请检查该网站的 Surge 分流或稍后重试`));
                return;
            }

            const status = Number(response && (response.status || response.statusCode));
            debug(`${label} HTTP ${status}`);

            if (typeof text === "string" && /cloudflare|attention required|cf-mitigated/i.test(text.slice(0, 500)) && status === 403) {
                reject(new Error(`${label}被 Cloudflare 拦截（403），请手动在浏览器里签到`));
                return;
            }

            if (status < 200 || status >= 300 || !status) {
                // 签到接口用 {error:{code,message}} 返回 4xx，调用方按业务错误处理，
                // 所以这里把 JSON 错误体也带回去，而不是直接丢掉。
                let json = null;
                try { json = JSON.parse(text); } catch (_) {}
                if (json && typeof json === "object" && json.error) {
                    resolve({ json, status, headers: response.headers || {} });
                    return;
                }
                reject(new Error(`${label}返回 HTTP ${status || "未知"}，请在浏览器确认网站是否可访问或需要验证`));
                return;
            }

            let json = null;
            try {
                json = JSON.parse(text);
            } catch (_) {
                reject(new Error(`${label}返回非 JSON 内容，可能是网页验证或服务异常，请到网站检查`));
                return;
            }

            if (!json || typeof json !== "object" || Array.isArray(json)) {
                reject(new Error(`${label}响应格式异常，请到网站检查`));
                return;
            }

            resolve({ json, status, headers: response.headers || {} });
        });
    });
}

function debug(message) {
    if (PLUGIN.debug === true || PLUGIN.debug === "true" || $.getdata(DEBUG_KEY) === "true") $.log(`[DEBUG] ${message}`);
}

// 保留当天带奖励的旧记录（状态、奖励文字、时间），合并本次拿到的资产、过期时间等；本次没有的沿用旧值
function keepReward(old, rec) {
    const out = { s: old.s, msg: old.msg, t: old.t, asset: old.asset, exp: old.exp };
    for (const k in rec) if (rec[k] !== undefined && k !== "s" && k !== "msg") out[k] = rec[k];
    return out;
}

// 签到状态协议 v1：写本次结果，并把自己登记进公共索引 checkin_registry（Loon/Surge/QX/Stash 通用，不依赖 Env）
function checkinReport(key, rec, info) {
    const read = (k) => (typeof $prefs !== "undefined" ? $prefs.valueForKey(k) : $persistentStore.read(k));
    const write = (v, k) => (typeof $prefs !== "undefined" ? $prefs.setValueForKey(v, k) : $persistentStore.write(v, k));
    const registry = () => { try { return JSON.parse(read("checkin_registry") || "{}") || {}; } catch (e) { return {}; } };
    write(JSON.stringify(Object.assign({ v: 1, t: Date.now(), name: info.name, author: info.author }, rec)), key);
    const reg = registry();
    if (JSON.stringify(reg[key]) === JSON.stringify(info)) return;
    reg[key] = info;
    write(JSON.stringify(reg), "checkin_registry");
    if (!registry()[key]) console.log(`[checkin] ${key} 登记没写上，下次运行再补`);
}

function Env(s) {
    this.name = s;
    this.isSurge = () => typeof $httpClient !== "undefined";
    this.isQuanX = () => typeof $task !== "undefined";
    this.isLoon = () => typeof $loon !== "undefined";
    this.log = (...a) => console.log(a.join("\n"));
    this.msg = (t = this.name, s = "", b = "") => {
        if (this.isSurge() || this.isLoon()) $notification.post(t, s, b);
        else if (this.isQuanX()) $notify(t, s, b);
        console.log(["", `====📣${t}====`, s, b].filter(Boolean).join("\n"));
    };
    this.getdata = (k) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.read(k);
        if (this.isQuanX()) return $prefs.valueForKey(k);
        return null;
    };
    this.setdata = (v, k) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.write(v, k);
        if (this.isQuanX()) return $prefs.setValueForKey(v, k);
        return false;
    };
    this.send = (req, method, cb) => {
        if (this.isSurge() || this.isLoon()) {
            const fn = method === "POST" ? $httpClient.post : $httpClient.get;
            fn(req, (err, resp, data) => {
                if (resp) {
                    resp.body = data;
                    resp.statusCode = resp.status || resp.statusCode;
                }
                cb(err, resp, data);
            });
        } else if (this.isQuanX()) {
            req.method = method;
            $task.fetch(req).then(
                (r) => {
                    r.status = r.statusCode;
                    cb(null, r, r.body);
                },
                (e) => cb(e.error || e, null, null),
            );
        }
    };
    this.done = (v = {}) => {
        if (typeof $done !== "undefined") $done(v);
    };
}
