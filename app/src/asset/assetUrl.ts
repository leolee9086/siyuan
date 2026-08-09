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
    const runtimeBase = documentBase || (typeof window !== "undefined" ? window.location.origin : "");
    if (!runtimeBase) {
        throw new Error("资源 URL 缺少运行时基地址");
    }
    if (!configuredBase) {
        return runtimeBase;
    }
    try {
        return new URL(configuredBase, runtimeBase).href;
    } catch (error) {
        throw new Error(`资源基地址无效: ${configuredBase}`, {cause: error});
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
        if (!origin || origin === "null") {
            throw new Error("资源 URL 缺少有效应用 origin");
        }
        return origin;
    } catch (error) {
        if (error instanceof Error && error.message === "资源 URL 缺少有效应用 origin") {
            throw error;
        }
        throw new Error(`资源基地址缺少有效应用 origin: ${base}`, {cause: error});
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
 * 将资源标识解析为可直接交给浏览器的 URL。
 * @同步豁免: 需要绝对同步的DOM访问 - 图片/媒体元素在渲染时必须立即取得 src，异步化会导致首帧使用错误地址。
 */
export function resolveAssetURL(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error("资源地址为空");
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
        } catch (error) {
            throw new Error(`资源地址无效: ${value}`, {cause: error});
        }
    }
    try {
        return new URL(value, getAssetBaseURL()).href;
    } catch (error) {
        throw new Error(`资源地址无效: ${value}`, {cause: error});
    }
}
