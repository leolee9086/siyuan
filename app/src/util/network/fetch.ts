/** 用途：IPC 通信常量标识 | 使用范围：handleFetchError 中 Electron 退出消息 | 解耦评估：基础设施配置，无法解耦 */
import { Constants } from "./imports";
/** 用途：Electron 主进程通信 | 使用范围：handleFetchError 中系统退出/工作空间切换通知 | 解耦评估：Electron 基础设施，无法解耦 */
import { ipcSend } from "./imports";
/** 用途：判断 Electron 环境 | 使用范围：handleFetchError 中判断是否执行 Electron 退出逻辑 | 解耦评估：平台判断基础设施，无法解耦 */
import { isElectron } from "./imports";
/** 用途：处理后端通知/错误消息 | 使用范围：createPostResponseHandler 和 fetchSyncPost 中展示消息 | 解耦评估：网络模块基础功能，可考虑依赖注入但当前直接导入符合实际场景 */
import { processMessage } from "./processMessage";
/** 用途：验证响应数据结构 | 使用范围：fetchSyncPost 中验证 IWebSocketData 格式 | 解耦评估：工具函数，直接导入符合模块化设计 */
import { isWebSocketData } from "./fetch.guard";
/** 用途：请求数据类型 | 使用范围：所有 fetch 函数参数类型 | 解耦评估：类型定义，直接导入符合设计 */
import { TFetchRequestData } from "./types";
/** 用途：请求上下文类型 | 使用范围：中间件和 fetch 函数内部传递上下文 | 解耦评估：类型定义，直接导入符合设计 */
import { FetchContext } from "./types";
/** 用途：中间件类型 | 使用范围：中间件函数类型声明 | 解耦评估：类型定义，直接导入符合设计 */
import { FetchMiddleware } from "./types";
/** 用途：获取请求 ID 用于竞态控制 | 使用范围：injectReqIdMiddleware 和 createPostResponseHandler 中竞态检查 | 解耦评估：全局状态管理，无法解耦 */
import { getSiyuanReqId } from "./imports";
/** 用途：设置请求 ID 用于竞态控制 | 使用范围：injectReqIdMiddleware 中记录请求时间戳 | 解耦评估：全局状态管理，无法解耦 */
import { setSiyuanReqId } from "./imports";
/** 用途：认证失效时重载页面 | 使用范围：handleFetchResponse 中 401 错误处理 | 解耦评估：浏览器基础设施，无法解耦 */
import { reloadLocation } from "./imports";
/** 用途：SForge 全局状态管理 | 使用范围：请求信号量跨模块持久化 | 解耦评估：基础设施，需全局单例 */
import { getSForgeState, setSForgeState } from "../../config/sforge.global";
import { SForgeSymbols } from "../../config/sforge.symbols";
import type { IRequestSemaphore } from "../../config/sforge.types";

const maxConcurrent = 6;

function getSemaphore(): IRequestSemaphore {
	let s = getSForgeState(SForgeSymbols.REQUEST_SEMAPHORE);
	if (!s) {
		s = { current: 0, pending: [] };
		setSForgeState(SForgeSymbols.REQUEST_SEMAPHORE, s);
	}
	return s;
}

function acquire(): Promise<void> {
	const s = getSemaphore();
	if (s.current < maxConcurrent) {
		s.current++;
		return Promise.resolve();
	}
	return new Promise(resolve => {
 s.pending.push(resolve); 
});
}

function release(): void {
	const s = getSemaphore();
	s.current--;
	const next = s.pending.shift();
	if (next) {
		s.current++;
		next();
	}
}

function handleKernelError(): void {
    const handlers = getSForgeState(SForgeSymbols.MODEL_HANDLERS);
    if (handlers?.kernelError) {
        handlers.kernelError();
        return;
    }
    console.warn("kernelError handler not registered");
}

/**
 * 需要进行请求竞态控制的特殊 API 列表
 *
 * 这些 API 是高频触发的搜索/图谱请求，需要通过 reqId 机制
 * 确保后发先至的响应不会覆盖最新请求的结果。
 */
const 需要竞态控制的API列表: readonly string[] = [
    "/api/search/searchRefBlock",
    "/api/graph/getGraph",
    "/api/graph/getLocalGraph",
    "/api/block/getRecentUpdatedBlocks",
    "/api/search/fullTextSearchBlock",
    "/api/search/semanticSearchBlock",
];


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
 * 中间件：为请求数据注入 reqId 以支持竞态控制
 *
 * @remarks
 * **reqId 竞态控制机制**：
 * 对于搜索、图谱等高频请求场景，用户可能在短时间内触发多次请求。
 * 由于网络延迟，后发的请求可能先返回，导致旧数据覆盖新数据。
 * 通过在请求中注入时间戳作为 reqId，响应处理时可对比丢弃过期响应。
 */
const injectReqIdMiddleware: FetchMiddleware = (ctx) => {
    if (!ctx.data || ctx.data instanceof FormData) {
        return;
    }
    
    // 对于高频搜索/图谱请求，记录请求时间戳用于后续竞态检查
    if (需要竞态控制的API列表.includes(ctx.url)) {
        setSiyuanReqId(ctx.url, Date.now());
    }
    
    const isNotLocalGraph = ctx.data.type !== "local" || ctx.url !== "/api/graph/getLocalGraph";
    const reqId = getSiyuanReqId(ctx.url);
    
    // 将 reqId 注入请求数据，以便响应时验证（排除 local 类型的本地图谱，因其不需要竞态控制）
    if (需要竞态控制的API列表.includes(ctx.url) && isNotLocalGraph && reqId !== undefined) {
        ctx.data.reqId = reqId;
    }
    
    // 事务 API 总是需要唯一标识以保证操作顺序
    if (ctx.url === "/api/transactions") {
        ctx.data.reqId = Date.now();
    }
};

/**
 * 中间件：序列化请求数据为 HTTP body
 */
const serializeRequestDataMiddleware: FetchMiddleware = (ctx) => {
    if (!ctx.data) {
        ctx.serializedBody = null;
        return;
    }
    // FormData 直接透传，不需要序列化
    if (ctx.data instanceof FormData) {
        ctx.serializedBody = ctx.data;
        return;
    }
    ctx.serializedBody = JSON.stringify(ctx.data);
};


/**
 * 统一处理 fetch 请求失败
 *
 * @param url - 请求的 API 路径
 * @param data - 原始请求数据
 * @param e - 捕获的错误对象
 * @param failCallback - 失败回调
 */
const handleFetchError = (url: string, data: TFetchRequestData | undefined, e: Error, failCallback?: (response: IWebSocketData) => void) => {
    // 当 /api/file/getFile 请求失败且提供了 failCallback 时，优先调用 failCallback 让调用者自行处理
    // 文件获取失败是常见场景（如文件不存在），调用者可能希望静默处理而非触发通用警告日志
    if (failCallback && url === "/api/file/getFile") {
        failCallback({
            data: null,
            msg: e.message,
            code: 400,
        });
        return;
    }
    console.warn("fetch post failed [" + e + "], url [" + url + "]");
    // 特殊处理事务 API 的网络失败或解析错误，触发内核重传或重启确认。
    if (url === "/api/transactions" && (e.message === "Failed to fetch" || e.message === "Unexpected end of JSON input")) {
        handleKernelError();
        return;
    }
    const dataErrorExit = data && !(data instanceof FormData) ? data.errorExit : undefined;
    const isExitCall = url === "/api/system/exit" || url === "/api/system/setWorkspaceDir" || (
        ["/api/system/setUILayout"].includes(url) && dataErrorExit
    );
    // 如果请求涉及系统退出或工作空间迁移，则通知 Electron 进程执行退出逻辑。
    if (isElectron && isExitCall) {
        ipcSend(Constants.SIYUAN_QUIT, location.port);
    }
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
    // 权限不足（403）或资源不存在（404）时，构造对应的错误响应对象，避免前端流程崩溃。
    if (response.status === 403 || response.status === 404) {
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    // 认证失效时延迟 3 秒重载页面，以便在刷新前保持当前界面状态供用户观察。
    if (401 == response.status) {
        // 延迟 3 秒重载页面，以便在刷新前保持当前界面状态供用户观察
        setTimeout(() => {
            reloadLocation();
        }, 3000);
        // return error to stop processing? The original code returns the parsed body or error object.
        // Remote triggers reload but also returns {data: null...} IF it flows through default?
        // Wait, remote has: case 401: setTimeout... return { ... }
        return {
            data: null,
            msg: response.statusText,
            code: -response.status,
        };
    }
    const contentType = response.headers.get("content-type");
    // 根据 Content-Type 响应头决定解析 JSON 还是纯文本。
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
        // 如果响应是字符串（非标准 JSON），直接交由业务回调处理。
        if (typeof response === "string") {
            cb?.(response);
            return;
        }
        const currentReqId = getSiyuanReqId(url);
        // 执行请求竞态检查：如果接收到的响应 reqId 小于最新发送的 reqId，说明是过期的响应，应当丢弃以免覆盖新数据。
        if (需要竞态控制的API列表.includes(url) && response.data?.reqId && currentReqId && currentReqId > response.data.reqId) {
            return;
        }
        if (!cb) {
            return;
        }
        const isMessage = typeof response === "object" && typeof response.msg === "string" && typeof response.code === "number";
        // 验证响应是否为标准的后端消息格式，并调用通用消息处理器。
        // processMessage 如果返回 true，表示该响应已通过校验且不属于拦截型系统消息（如 UI 重载或特定指令），应继续传递给业务回调处理。
        if (isMessage && processMessage(response, { fetchPost })) {
            cb(response);
            return;
        }
        // 如果响应不符合标准消息格式，则作为原始数据透传给业务回调。
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
 * // @AIDONE 在不改变对外行为的基础上,此函数自身的实现应该由.then调用改为async await
 */
export const fetchPost = async (
    url: string,
    data?: TFetchRequestData,
    cb?: (response: IWebSocketData) => void,
    headers?: IObject,
    failCallback?: (response: IWebSocketData) => void,
    signal?: AbortSignal,
    bypassSemaphore = false,
) => {
    if (!bypassSemaphore) {
        await acquire();
    }
    let released = false;
    try {
        // 创建请求上下文
        const ctx: FetchContext = { url, data, serializedBody: null };
        // 中间件1: 注入 reqId 用于竞态控制
        injectReqIdMiddleware(ctx);
        // 中间件2: 序列化请求数据
        serializeRequestDataMiddleware(ctx);

        const init: RequestInit = {
            method: "POST",
            body: ctx.serializedBody,
        };
        if (headers) {
            init.headers = headers;
        }
        if (signal) {
            init.signal = signal;
        }
        let isGetFile202 = false;
        const response = await fetch(url, init);
        // 检查 getFile 接口是否返回 202 状态码（表示文件尚未就绪或需要特殊处理）
        if (response.status === 202 && url === "/api/file/getFile") {
            isGetFile202 = true;
        }
        const responseData: IWebSocketData = await handleFetchResponse(response);

        if (!bypassSemaphore) {
 release(); released = true; 
}

        // 处理 getFile API 的特殊响应（如内核返回 202 状态码时，直接调用 failCallback）
        if (failCallback && url === "/api/file/getFile" && isGetFile202) {
            failCallback(responseData);
            return;
        }
        createPostResponseHandler(url, cb)(responseData);
    } catch (e) {
        if (!bypassSemaphore && !released) {
 release(); 
}
        if ((e as DOMException)?.name === "AbortError") {
            console.warn(`fetchPost aborted: ${url}`, (e as DOMException)?.message || "");
            return;
        }
        const error = e instanceof Error ? e : new Error(String(e));
        handleFetchError(url, data, error, failCallback);
    }
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
    await acquire();
    let released = false;
    try {
        const ctx: FetchContext = { url, data, serializedBody: null };
        injectReqIdMiddleware(ctx);
        serializeRequestDataMiddleware(ctx);

        const init: RequestInit = {
            method: "POST",
            body: ctx.serializedBody,
        };
        const res = await fetch(url, init);
        const jsonResult: unknown = await res.json();
        if (!isWebSocketData(jsonResult)) {
            throw new Error(`fetchSyncPost: 响应格式不符合预期 (url: ${url})`);
        }
        release(); released = true;
        processMessage(jsonResult, { fetchPost });
        return jsonResult;
    } catch (e) {
        if (!released) {
 release(); 
}
        throw e;
    }
};

/**
 * 发送 POST 请求并获取原始响应（不验证 IWebSocketData 格式）
 *
 * 专门用于 /api/file/getFile 等返回非标准格式的 API。
 * 这些 API 直接返回文件内容，而非包装在 {code, msg, data} 结构中。
 * @显式返回类型原因 泛型函数类型的返回值类型
 */
export const fetchSyncPostRaw = async <T = unknown>(url: string, data?: TFetchRequestData): Promise<T> => {
    const ctx: FetchContext = { url, data, serializedBody: null };
    injectReqIdMiddleware(ctx);
    serializeRequestDataMiddleware(ctx);
    
    const init: RequestInit = {
        method: "POST",
        body: ctx.serializedBody,
    };
    const res = await fetch(url, init);
    return await res.json();
};

/**
 * 发送 GET 请求（回调风格）
 *
 * 主要用于获取静态资源，如语言文件、主题配置等。
 * 不进行 reqId 竞态控制，不调用 processMessage。
 * @同步豁免: 遗留代码 - 回调风格的 API，保持向后兼容
 */
export const fetchGet = (url: string, cb: (response: IWebSocketData | IObject | string) => void) => {
    fetch(url)
        .then(handleFetchResponse)
        .then((response) => {
            cb(response);
        });
};
