/**
 * NodeLoc · 在浏览器里自动抓 Cookie（供 Cookie 版签到用）
 *
 * 这是一个 http-request 脚本：你在浏览器里打开 NodeLoc（登录状态）时，
 * Surge 会拦截到 www.nodeloc.com 的请求，本脚本从请求头里取出 Cookie，
 * 去掉 Cloudflare 的 __cf_bm / _cfuvid / cf_clearance，只保留登录会话，
 * 存到 $persistentStore（nodeloc_cookie），签到脚本（nodeloc-cookie.js）
 * 下次运行直接用最新抓到的 Cookie，不用手动复制。
 *
 * 开关：模块参数 capture_cookie（默认开）。
 *   - 想让它自动抓：保持 capture_cookie=true（默认），在浏览器里打开一次
 *     NodeLoc 即可（要登录状态）。
 *   - 不想让它自动抓：把 capture_cookie 改成 false，或在 Surge 脚本列表里
 *     单独关掉“NodeLoc Cookie 获取”这一项。
 *   只在 Cookie 变了的时候才保存并弹一次通知“Cookie 已更新”；没变、没登录、
 *   或开关关着时不打扰。
 *
 * 注意：
 *   - 需要 MITM：模块里已配 hostname = www.nodeloc.com，首次使用请按 Surge
 *     提示安装并信任证书，否则拦截不到 HTTPS 请求，抓不到 Cookie。
 *   - 只抓你自己浏览器发往 NodeLoc 的请求，不改请求内容，不发任何数据出去。
 *   - 没登录时请求头里一般只有 Cloudflare 的 Cookie，本脚本不会保存
 *     （避免把没用的 Cloudflare Cookie 覆盖掉已有的登录会话）。
 *   - Cookie 等于登录态，存在本机 $persistentStore，只给签到脚本自己用。
 *
 * 本版作者：Muse，Surge / Loon / Quantumult X / Stash 通用脚本。
 * 配合 nodeloc-cookie.js（Cookie 版签到）使用，见 README.md。
 *
 * ===== Surge（见 nodeloc-cookie.sgmodule）=====
 * [Script]
 * NodeLoc Cookie获取 = type=http-request,pattern=^https://www\.nodeloc\.com/,requires-body=0,script-path=https://cdn.jsdelivr.net/gh/JiuYueQingCheng/nodeloc-surge-checkin-cookie@main/nodeloc-cookie-capture.js,argument=capture_cookie=true
 */

const $ = new Env("NodeLoc Cookie 获取");

const SCRIPT_VERSION = "2026-11-26.r1";

$.log(`[INFO] 脚本版本 ${SCRIPT_VERSION}`);

const COOKIE_KEY = "nodeloc_cookie";
const CAPTURE_KEY = "nodeloc_cookie_capture";
const UPDATED_AT_KEY = "nodeloc_cookie_updated_at";

// Cloudflare 的 Cookie：不是登录会话，抓到了也没用，还可能过期很快，过滤掉。
const CF_COOKIES = ["__cf_bm", "_cfuvid", "cf_clearance"];

// $argument 在 Surge 里是字符串，在 Loon 里是对象，在 QX/Stash 里不存在。
const PLUGIN = parseArgument(typeof $argument !== "undefined" ? $argument : null);

function parseArgument(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return {};
    const text = raw.trim();
    if (!text) return {};
    if (text.startsWith("{")) {
        try { return JSON.parse(text); } catch (_) { return {}; }
    }
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

// 从 Cookie 请求头里去掉 Cloudflare 的 Cookie，只留登录会话。
// 返回清理后的 Cookie 字符串；如果只剩 Cloudflare 的（即没登录），返回 ""。
function extractSessionCookie(header) {
    if (typeof header !== "string" || !header.trim()) return "";
    const kept = [];
    for (const part of header.split(";")) {
        const item = part.trim();
        if (!item) continue;
        const eq = item.indexOf("=");
        const name = (eq >= 0 ? item.slice(0, eq) : item).trim();
        if (!name) continue;
        if (CF_COOKIES.indexOf(name.toLowerCase()) >= 0) continue;
        kept.push(item);
    }
    return kept.join("; ");
}

// 不区分大小写取请求头
function getHeader(headers, name) {
    if (!headers || typeof headers !== "object") return "";
    const want = String(name).toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v.join("; ") : String(v == null ? "" : v);
        }
    }
    return "";
}

(function main() {
    try {
        if (!isCaptureOn()) {
            debug("捕获开关已关，不抓 Cookie");
            return $done({});
        }

        const headers = (typeof $request !== "undefined" && $request && $request.headers) || {};
        const rawCookie = getHeader(headers, "Cookie");
        if (!rawCookie) {
            debug("请求里没有 Cookie，不抓");
            return $done({});
        }

        const sessionCookie = extractSessionCookie(rawCookie);
        if (!sessionCookie) {
            debug("Cookie 里只有 Cloudflare 的（没登录），不抓");
            return $done({});
        }

        const stored = $.getdata(COOKIE_KEY) || "";
        if (stored === sessionCookie) {
            debug("Cookie 没变，不重复保存");
            return $done({});
        }

        $.setdata(sessionCookie, COOKIE_KEY);
        $.setdata(String(Date.now()), UPDATED_AT_KEY);
        debug("Cookie 已更新并保存");
        $.msg($.name, "✅ NodeLoc Cookie 已更新", "浏览器里刚抓到的登录会话已保存，签到脚本下次运行直接用它");
    } catch (error) {
        // 抓 Cookie 失败不拦请求，只记一条日志。
        $.log(`[WARN] 抓 Cookie 失败：${error && error.message ? error.message : error}`);
    }
    return $done({});
})();

function debug(message) {
    if (PLUGIN.debug === true || PLUGIN.debug === "true" || $.getdata("nodeloc_cookie_debug") === "true") $.log(`[DEBUG] ${message}`);
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
    this.done = (v = {}) => {
        if (typeof $done !== "undefined") $done(v);
    };
}
