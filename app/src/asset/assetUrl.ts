/**
 * 作用：识别 Windows 盘符、UNC 和扩展路径。
 * 意图：避免把本地盘符中的冒号误判为 URL scheme。
 * 调用时机：统一解析图片、音视频和下载地址时。
 */
function isWindowsAbsolutePath(value: string) {
    return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

/**
 * 作用：把 Windows 文件系统路径编码成浏览器可解析的 file URL。
 * 意图：保留空格、中文和 UNC 主机边界，避免原始反斜杠被 URL 解析器误读。
 * 调用时机：资源入口收到绝对 Windows 路径时。
 */
function windowsPathToFileURL(value: string) {
    const withoutExtendedPrefix = value.startsWith("\\\\?\\") ? value.slice(4) : value;
    const normalized = withoutExtendedPrefix.replaceAll("\\", "/");
    // UNC 路径的第一段是主机名，必须放在 file URL 的 authority 位置。
    if (normalized.startsWith("//")) {
        const [host, ...segments] = normalized.slice(2).split("/");
        return `file://${host}/${segments.map(encodeURIComponent).join("/")}`;
    }
    const [drive, ...segments] = normalized.split("/");
    return `file:///${drive}/${segments.map(encodeURIComponent).join("/")}`;
}

/**
 * 作用：读取应用运行时为旧版资源路径配置的同源基地址。
 * 意图：兼容 desktop、stage 和嵌入式页面的相对资源解析，同时保证 href 本身为相对值时仍可解析。
 * 调用时机：resolveAssetURL 处理非绝对资源标识时。
 */
function getAssetBaseURL() {
    const documentBase = typeof document !== "undefined" ? document.baseURI : "";
    const baseElement = typeof document !== "undefined" ? document.getElementById("baseURL") : null;
    const configuredBase = baseElement?.getAttribute("href")?.trim() || "";
    const fallback = documentBase || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (!configuredBase) {
        return fallback;
    }
    try {
        return new URL(configuredBase, fallback).href;
    } catch {
        return fallback;
    }
}

/**
 * 作用：取得应用 HTTP 根地址，而不是 webpack 静态资源基路径。
 * 意图：文件浏览器的 `/api/...` 必须落到内核路由；即使页面运行在
 * `/stage/build/desktop/` 下，也不能把 API 拼到该目录中。
 * 调用时机：解析根相对文件浏览器内容和缩略图地址时。
 */
function getApplicationOrigin() {
    const locationOrigin = typeof window !== "undefined" ? window.location.origin : "";
    if (locationOrigin && locationOrigin !== "null") {
        return locationOrigin;
    }
    const base = getAssetBaseURL();
    try {
        const origin = new URL(base).origin;
        return origin && origin !== "null" ? origin : base;
    } catch {
        return base;
    }
}

/**
 * 旧版文件页签曾把同源 API 拼到静态构建目录下。恢复这些页签时，
 * 只要仍然保留 `/stage/build/.../api/...`，浏览器就会收到应用壳文本而不是图片。
 * 只对 s-forge 文件浏览 API 做定向归一化，避免影响普通静态资源和远程地址。
 */
function normalizeLegacyFileBrowserPath(value: string) {
    let normalized = value.replaceAll("\\", "/");
    const endpoint = "/api/s-forge/file-browser/";
    // 同源绝对旧地址也可能来自已持久化页签；远程 CDN 地址留给浏览器原样处理。
    if (/^https?:\/\//i.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            if (parsed.origin !== getApplicationOrigin()) {
                return undefined;
            }
            normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
            return undefined;
        }
    }
    if (normalized.startsWith("api/s-forge/file-browser/")) {
        return `/${normalized}`;
    }
    const buildMarker = "/stage/build/";
    const markerIndex = normalized.indexOf(endpoint);
    if (markerIndex > 0 && normalized.slice(0, markerIndex).includes(buildMarker)) {
        return normalized.slice(markerIndex);
    }
    return undefined;
}

/**
 * SACAssetsManager 使用的透明像素占位；图片地址异步切换或失效时保持卡片尺寸稳定。
 */
export const EMPTY_IMAGE_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgAB/ax5LIAAAAAASUVORK5CYII=";

/**
 * 将资源标识解析为可直接交给浏览器的 URL。
 * @同步豁免: 需要绝对同步的DOM访问 - 图片/媒体元素在渲染时必须立即取得 src，异步化会导致首帧使用错误地址。
 */
export function resolveAssetURL(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return value;
    }
    // Windows 路径的盘符冒号不是 URL scheme；桌面端仍需把它转换为合法 file URL。
    if (isWindowsAbsolutePath(trimmed)) {
        return windowsPathToFileURL(trimmed);
    }
    // 旧 bundle 可能把同源 API 拼成绝对的静态构建路径，这里只修复同源 HTTP(S)。
    if (/^https?:\/\//i.test(trimmed)) {
        const legacyFileBrowserPath = normalizeLegacyFileBrowserPath(trimmed);
        return legacyFileBrowserPath ? resolveAssetURL(legacyFileBrowserPath) : value;
    }
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed)) {
        return value;
    }
    const legacyFileBrowserPath = normalizeLegacyFileBrowserPath(trimmed);
    if (legacyFileBrowserPath) {
        return resolveAssetURL(legacyFileBrowserPath);
    }
    // 根相对 API/静态资源脱离 webpack publicPath；这正是文件浏览器
    // 内容和缩略图入口的关键区别，避免命中应用壳文本。
    if (trimmed.startsWith("/")) {
        try {
            return new URL(trimmed, `${getApplicationOrigin().replace(/\/$/, "")}/`).href;
        } catch {
            return value;
        }
    }
    try {
        return new URL(value, getAssetBaseURL()).href;
    } catch {
        return value;
    }
}

/**
 * 作用：解码内容 URL 的一个路径段。
 * 意图：兼容中文、空格和旧页签中的不完整百分号编码，同时保留不可解码输入供后续校验。
 * 调用时机：解析文件浏览器内容地址以构造同根缩略图请求时。
 */
function decodeAssetPathSegment(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * 从文件浏览器内容地址提取授权根和根内路径。
 * 意图：图片查看器回退到缩略图时仍使用同一根边界，不把本地绝对路径暴露给前端。
 */
function parseFileBrowserContentURL(value: string) {
    const resolved = resolveAssetURL(value);
    try {
        const parsed = new URL(resolved, getApplicationOrigin());
        if (parsed.origin !== getApplicationOrigin()) {
            return undefined;
        }
        const prefix = "/api/s-forge/file-browser/content/";
        if (!parsed.pathname.startsWith(prefix)) {
            return undefined;
        }
        const segments = parsed.pathname.slice(prefix.length).split("/").filter(Boolean);
        if (segments.length < 2) {
            return undefined;
        }
        const rootID = decodeAssetPathSegment(segments.shift() ?? "");
        const path = segments.map(decodeAssetPathSegment).join("/");
        return rootID && path ? {rootID, path} : undefined;
    } catch {
        return undefined;
    }
}

/**
 * 为文件浏览器的原图内容地址生成同源缩略图地址。
 * 参考 SACAssetsManager：原图用于大图查看，缩略图仅用于加载失败或尺寸受限的回退路径。
 * @同步豁免: 性能考虑 - 图片元素渲染期间必须立即取得稳定的 src，异步返回会产生首帧空地址和布局抖动。
 */
export function getFileBrowserThumbnailURL(value: string, size = 1024) {
    const file = parseFileBrowserContentURL(value);
    if (!file) {
        return undefined;
    }
    const params = new URLSearchParams({
        rootID: file.rootID,
        path: file.path,
        size: String(Math.max(1, Math.round(size))),
    });
    return resolveAssetURL(`/api/s-forge/file-browser/thumbnail?${params.toString()}`);
}
