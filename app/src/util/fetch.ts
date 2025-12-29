import { Constants } from "../constants";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { processMessage } from "./processMessage";
import { kernelError } from "../dialog/processSystem";
import { isWebSocketData } from "./fetch.guard";
import { TFetchRequestData } from "./fetch.types";
import { getSiyuanReqId, setSiyuanReqId } from "./siyuanEnvironments/getSiyuanConfig.environment";
import { reloadLocation } from "./siyuanEnvironments/windowLocation.environment";

/**
 * @file fetch.ts
 * @description 思源笔记前端 HTTP 请求封装模块
 *
 * 封装了与思源内核 API 通信的核心方法，提供以下能力：
 * - **请求竞态处理**：通过 reqId 机制确保异步场景下不会用过期响应覆盖最新数据
 * - **响应验证**：使用类型守卫验证响应结构符合 IWebSocketData
 * - **统一错误处理**：网络错误、HTTP 错误码（401/403/404）的统一处理
 * - **消息展示**：自动调用 processMessage 处理后端返回的通知/错误消息
 *
 * @example
 * // 异步请求，通过回调获取结果
 * fetchPost("/api/filetree/getDoc", { id: blockId }, (response) => {
 *     console.log(response.data);
 * });
 *
 * // 同步风格请求（返回 Promise）
 * const result = await fetchSyncPost("/api/block/checkBlockExist", { id: blockId });
 */

/**
 * 准备 POST 请求的 body 数据
 *
 * 此函数承担两个职责：
 * 1. 将请求对象序列化为 JSON（FormData 则直接透传）
 * 2. 为特定 API 注入 reqId 以支持请求竞态控制
 *
 * @param url - 请求的 API 路径
 * @param data - 请求数据，可以是普通对象或 FormData
 * @returns 序列化后的 JSON 字符串、原始 FormData 或 null
 *
 * @remarks
 * **reqId 竞态控制机制**：
 * 对于搜索、图谱等高频请求场景，用户可能在短时间内触发多次请求。
 * 由于网络延迟，后发的请求可能先返回，导致旧数据覆盖新数据。
 * 通过在请求中注入时间戳作为 reqId，响应处理时可对比丢弃过期响应。
 */
const setupRequestData = (url: string, data?: TFetchRequestData) => {
    if (!data) {
        return null;
    }
    // 先检查 FormData，后续代码可以安全地访问对象属性
    if (data instanceof FormData) {
        return data;
    }
    const specialUrls = ["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
        "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"];
    if (specialUrls.includes(url)) {
        setSiyuanReqId(url, new Date().getTime());
    }
    const isNotLocalGraph = data.type !== "local" || url !== "/api/graph/getLocalGraph";
    const reqId = getSiyuanReqId(url);
    if (specialUrls.includes(url) && isNotLocalGraph && reqId !== undefined) {
        data.reqId = reqId;
    }
    if (url === "/api/transactions") {
        data.reqId = new Date().getTime();
    }
    return JSON.stringify(data);
};


/**
 * 统一处理 fetch 请求失败
 *
 * @param url - 请求的 API 路径
 * @param data - 原始请求数据
 * @param e - 捕获的错误对象
 *
 * @remarks
 * 特殊处理逻辑：
 * - **事务请求失败**：`/api/transactions` 失败时触发 kernelError，提示用户内核可能崩溃
 * - **退出类请求失败**（仅桌面端）：如 exit/setWorkspaceDir 失败，直接通知 Electron 退出
 */
const handleFetchError = (url: string, data: TFetchRequestData | undefined, e: Error) => {
    console.warn("fetch post failed [" + e + "], url [" + url + "]");
    if (url === "/api/transactions" && (e.message === "Failed to fetch" || e.message === "Unexpected end of JSON input")) {
        kernelError();
        return;
    }
    /// #if !BROWSER
    const dataErrorExit = data && !(data instanceof FormData) ? data.errorExit : undefined;
    const isExitCall = url === "/api/system/exit" || url === "/api/system/setWorkspaceDir" || (
        ["/api/system/setUILayout"].includes(url) && dataErrorExit
    );
    if (isExitCall) {
        ipcRenderer.send(Constants.SIYUAN_QUIT, location.port);
    }
    /// #endif
};

/**
 * 处理 HTTP 响应，将 Response 转换为可用数据
 *
 * @param response - fetch 返回的 Response 对象
 * @returns JSON 对象、纯文本或错误信息对象
 *
 * @remarks
 * HTTP 状态码处理：
 * - **401 (Unauthorized)**：认证失效，3秒后自动刷新页面重新登录
 * - **403/404**：返回包含错误信息的标准响应对象，不抛出异常
 * - **其他**：根据 Content-Type 解析为 JSON 或文本
 */
const handleFetchResponse = (response: Response) => {
    if (response.status === 403 || response.status === 404) {
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    if (401 == response.status) {
        setTimeout(() => {
            reloadLocation();
        }, 3000);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") > -1) {
        return response.json();
    }
    return response.text();
};

/**
 * 创建 POST 响应处理器（高阶函数）
 *
 * @param url - 请求的 API 路径，用于竞态检查
 * @param cb - 业务回调函数
 * @returns 可直接传入 `.then()` 的响应处理函数
 *
 * @remarks
 * 处理流程：
 * 1. **字符串响应**：直接透传给回调（如纯文本 API）
 * 2. **竞态检查**：对比 reqId，丢弃过期响应避免数据错乱
 * 3. **消息处理**：调用 processMessage 展示通知/错误，code < 0 的响应不传递给业务回调
 * 4. **业务回调**：仅当 processMessage 返回 truthy 或响应非标准格式时调用
 */
const createPostResponseHandler = (url: string, cb?: (response: IWebSocketData) => void) => {
    return (response: IWebSocketData) => {
        if (typeof response === "string") {
            cb?.(response);
            return;
        }
        const specialUrls = ["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"];
        const currentReqId = getSiyuanReqId(url);
        if (specialUrls.includes(url) && response.data?.reqId && currentReqId && currentReqId > response.data.reqId) {
            return;
        }
        if (!cb) {
            return;
        }
        const isMessage = typeof response === "object" && typeof response.msg === "string" && typeof response.code === "number";
        if (isMessage && processMessage(response)) {
            cb(response);
            return;
        }
        if (!isMessage) {
            cb(response);
        }
    };
};

/**
 * 发送 POST 请求到思源内核 API（异步回调风格）
 *
 * 这是与思源内核通信的主要方法，支持自动序列化、竞态控制和消息处理。
 *
 * @param url - API 路径，如 "/api/filetree/getDoc"
 * @param data - 请求数据，支持普通对象或 FormData
 * @param cb - 响应回调，接收 IWebSocketData 格式的响应
 * @param headers - 可选的自定义请求头
 *
 * @example
 * // 获取文档内容
 * fetchPost("/api/filetree/getDoc", { id: "20210808180117-6v0mkxr" }, (response) => {
 *     if (response.code === 0) {
 *         console.log(response.data.content);
 *     }
 * });
 *
 * // 不需要回调的请求
 * fetchPost("/api/system/exit");
 */
export const fetchPost = (url: string, data?: TFetchRequestData, cb?: (response: IWebSocketData) => void, headers?: IObject) => {
    const init: RequestInit = {
        method: "POST",
        body: setupRequestData(url, data),
    };
    if (headers) {
        init.headers = headers;
    }
    fetch(url, init)
        .then(handleFetchResponse)
        .then(createPostResponseHandler(url, cb))
        .catch((e) => handleFetchError(url, data, e));
};

/**
 * 发送 POST 请求到思源内核 API（Promise/async-await 风格）
 *
 * 适用于需要在异步函数中等待结果的场景。
 * 与 fetchPost 不同，此方法会自动验证响应格式并抛出异常。
 *
 * @param url - API 路径
 * @param data - 请求数据
 * @returns Promise，resolve 为 IWebSocketData 格式的响应
 * @throws 当响应格式不符合 IWebSocketData 时抛出异常
 *
 * @example
 * // 在 async 函数中使用
 * const response = await fetchSyncPost("/api/block/checkBlockExist", { id: blockId });
 * if (response.data) {
 *     // 块存在
 * }
 */
export const fetchSyncPost = async (url: string, data?: TFetchRequestData) => {
    const init: RequestInit = {
        method: "POST",
        body: setupRequestData(url, data),
    };
    const res = await fetch(url, init);
    const jsonResult: unknown = await res.json();
    if (!isWebSocketData(jsonResult)) {
        throw new Error(`fetchSyncPost: 响应格式不符合预期 (url: ${url})`);
    }
    processMessage(jsonResult);
    return jsonResult;
};

/**
 * 发送 POST 请求并获取原始响应（不验证 IWebSocketData 格式）
 *
 * 专门用于 /api/file/getFile 等返回非标准格式的 API。
 * 这些 API 直接返回文件内容，而非包装在 {code, msg, data} 结构中。
 *
 * @param url - API 路径
 * @param data - 请求数据
 * @returns Promise，resolve 为 JSON 解析后的原始响应
 *
 * @example
 * // 获取文件内容
 * const content = await fetchSyncPostRaw("/api/file/getFile", { path: "/data/storage/file.json" });
 */
export const fetchSyncPostRaw = async <T = unknown>(url: string, data?: TFetchRequestData): Promise<T> => {
    const init: RequestInit = {
        method: "POST",
        body: setupRequestData(url, data),
    };
    const res = await fetch(url, init);
    return await res.json();
};

/**
 * 发送 GET 请求（回调风格）
 *
 * 主要用于获取静态资源，如语言文件、主题配置等。
 * 不进行 reqId 竞态控制，不调用 processMessage。
 *
 * @param url - 请求 URL（可包含查询参数）
 * @param cb - 响应回调，参数类型取决于响应的 Content-Type
 *
 * @example
 * fetchGet(`/appearance/langs/zh_CN.json?v=${version}`, (languages) => {
 *     window.siyuan.languages = languages;
 * });
 */
export const fetchGet = (url: string, cb: (response: IWebSocketData | IObject | string) => void) => {
    fetch(url)
        .then(handleFetchResponse)
        .then((response) => {
            cb(response);
        });
};
