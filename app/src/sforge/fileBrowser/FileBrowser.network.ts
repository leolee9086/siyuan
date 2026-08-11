/**
 * 网络文本文件的只读加载模型。
 *
 * 行为基线：Zuoqiu-Yingyi/siyuan-plugin-monaco-editor `edce237dab4ef807be3b8647087543bcb87d1ca7`
 * 的 `src/handlers/network.ts`。保留 GET、路径扩展名优先和无扩展名按
 * Content-Type 识别语言的语义；S-Forge 额外把请求取消、响应大小和解码错误
 * 固定在领域边界，避免 UI 把失败伪装成空文档。
 */

export const DEFAULT_NETWORK_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const MAX_NETWORK_FILE_MAX_BYTES = 32 * 1024 * 1024;

export type FileBrowserNetworkErrorCode =
    | "invalid-uri"
    | "request"
    | "http"
    | "too-large"
    | "decode"
    | "aborted";

/** 网络资源读取失败的稳定错误；调用方可按 code 显示具体状态。 */
export class FileBrowserNetworkError extends Error {
    constructor(
        public readonly code: FileBrowserNetworkErrorCode,
        message: string,
        public readonly status?: number,
        cause?: unknown,
    ) {
        super(message, cause === undefined ? undefined : {cause});
        this.name = "FileBrowserNetworkError";
    }
}

export interface FileBrowserNetworkReadOptions {
    uri: string;
    signal?: AbortSignal;
    maxBytes?: number;
    fetchImpl?: NetworkFetch;
}

export interface FileBrowserNetworkDocument {
    uri: string;
    name: string;
    text: string;
    language: string;
    contentType: string;
    size: number;
    readOnly: true;
}

export type NetworkFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const EXTENSION_LANGUAGES: Readonly<Record<string, string>> = {
    c: "c", cc: "cpp", cpp: "cpp", h: "cpp", hpp: "cpp",
    css: "css", csv: "plaintext", go: "go", htm: "html", html: "html",
    ini: "ini", java: "java", js: "javascript", jsx: "javascript", json: "json",
    log: "plaintext", mjs: "javascript", md: "markdown", py: "python", rs: "rust",
    scss: "scss", sh: "shell", sql: "sql", ts: "typescript", tsx: "typescript",
    toml: "ini", txt: "plaintext", vue: "vue", xml: "xml", yaml: "yaml", yml: "yaml",
};

const MIME_LANGUAGES: Readonly<Record<string, string>> = {
    "application/ecmascript": "javascript",
    "application/javascript": "javascript",
    "application/json": "json",
    "application/ld+json": "json",
    "application/sql": "sql",
    "application/typescript": "typescript",
    "application/xml": "xml",
    "application/x-sh": "shell",
    "text/css": "css",
    "text/html": "html",
    "text/javascript": "javascript",
    "text/markdown": "markdown",
    "text/plain": "plaintext",
    "text/x-c": "c",
    "text/x-c++": "cpp",
    "text/x-python": "python",
    "text/x-rust": "rust",
    "text/xml": "xml",
};

function maxBytesFor(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
        return DEFAULT_NETWORK_FILE_MAX_BYTES;
    }
    return Math.min(MAX_NETWORK_FILE_MAX_BYTES, Math.floor(value));
}

function parseURL(uri: string) {
    if (!uri.trim()) {
        throw new FileBrowserNetworkError("invalid-uri", "网络文件 URI 为空");
    }
    let url: URL;
    try {
        url = new URL(uri);
    } catch (cause) {
        throw new FileBrowserNetworkError("invalid-uri", "网络文件 URI 格式错误", undefined, cause);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new FileBrowserNetworkError("invalid-uri", "网络文件只支持 HTTP 或 HTTPS URI");
    }
    return url;
}

function contentTypeOf(response: Response) {
    return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(pathname: string) {
    const name = pathname.slice(pathname.lastIndexOf("/") + 1);
    const match = /\.([a-z0-9]+)$/i.exec(name);
    return match?.[1]?.toLowerCase() ?? "";
}

function languageFor(url: URL, contentType: string) {
    const extension = extensionOf(url.pathname);
    if (extension) {
        return EXTENSION_LANGUAGES[extension] ?? extension;
    }
    return MIME_LANGUAGES[contentType] ?? contentType;
}

function nameFor(url: URL) {
    const rawName = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    if (rawName) {
        try {
            return decodeURIComponent(rawName);
        } catch {
            return rawName;
        }
    }
    return url.hostname;
}

function isAbort(reason: unknown) {
    const DOMExceptionCtor = globalThis.DOMException;
    return (typeof DOMExceptionCtor === "function" && reason instanceof DOMExceptionCtor) ? reason.name === "AbortError" :
        reason instanceof Error && reason.name === "AbortError";
}

function contentLengthOf(response: Response) {
    const value = response.headers.get("content-length");
    if (!value || !/^\d+$/.test(value.trim())) {
        return undefined;
    }
    const length = Number(value);
    return Number.isSafeInteger(length) ? length : undefined;
}

async function readResponseText(response: Response, limit: number, signal?: AbortSignal) {
    const contentLength = contentLengthOf(response);
    if (contentLength !== undefined && contentLength > limit) {
        throw new FileBrowserNetworkError("too-large", `网络文件超过 ${limit} bytes 限制`);
    }
    if (signal?.aborted) {
        throw new FileBrowserNetworkError("aborted", "网络文件读取已取消");
    }
    try {
        const text = await response.text();
        if (signal?.aborted) {
            throw new FileBrowserNetworkError("aborted", "网络文件读取已取消");
        }
        const size = new TextEncoder().encode(text).byteLength;
        if (size > limit) {
            throw new FileBrowserNetworkError("too-large", `网络文件超过 ${limit} bytes 限制`);
        }
        return {text, size};
    } catch (reason) {
        if (reason instanceof FileBrowserNetworkError) {
            throw reason;
        }
        if (isAbort(reason)) {
            throw new FileBrowserNetworkError("aborted", "网络文件读取已取消", undefined, reason);
        }
        throw new FileBrowserNetworkError("decode", "网络文件文本解码失败", undefined, reason);
    }
}

/** 按参考插件契约读取网络文本，并返回明确只读模型。 */
export async function readFileBrowserNetworkFile(options: FileBrowserNetworkReadOptions): Promise<FileBrowserNetworkDocument> {
    const url = parseURL(options.uri);
    const limit = maxBytesFor(options.maxBytes);
    if (options.signal?.aborted) {
        throw new FileBrowserNetworkError("aborted", "网络文件读取已取消");
    }
    const fetchImpl: NetworkFetch = options.fetchImpl ?? (globalThis.fetch as NetworkFetch);
    let response: Response;
    try {
        const requestInit: RequestInit = {method: "GET"};
        if (options.signal) {
            requestInit.signal = options.signal;
        }
        response = await fetchImpl(options.uri, requestInit);
    } catch (reason) {
        if (isAbort(reason) || options.signal?.aborted) {
            throw new FileBrowserNetworkError("aborted", "网络文件读取已取消", undefined, reason);
        }
        throw new FileBrowserNetworkError("request", "网络文件请求失败", undefined, reason);
    }
    if (!response.ok) {
        const statusLabel = response.statusText ? ` ${response.statusText}` : "";
        throw new FileBrowserNetworkError("http", `网络文件请求失败: HTTP ${response.status}${statusLabel}`, response.status);
    }
    const contentType = contentTypeOf(response);
    const {text, size} = await readResponseText(response, limit, options.signal);
    return {
        uri: options.uri, name: nameFor(url), text,
        language: languageFor(url, contentType), contentType, size, readOnly: true,
    };
}

export const networkLanguageFor = languageFor;
