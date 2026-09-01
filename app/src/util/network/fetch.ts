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
/** 用途：识别请求取消异常。使用范围：fetchPost 错误传播；解耦评估：同目录外部输入守卫。 */
import {isAbortError} from "./fetch.guard";
/** 用途：请求数据类型 | 使用范围：所有 fetch 函数参数类型 | 解耦评估：类型定义，直接导入符合设计 */
import { TFetchRequestData } from "./types";
/** 用途：请求上下文类型 | 使用范围：中间件和 fetch 函数内部传递上下文 | 解耦评估：类型定义，直接导入符合设计 */
import { FetchContext } from "./types";
/** 用途：中间件类型 | 使用范围：中间件函数类型声明 | 解耦评估：类型定义，直接导入符合设计 */
import { FetchMiddleware } from "./types";
/** 用途：允许网络边界等待同步或异步迁移期回调。使用范围：POST/GET 响应与失败回调；解耦评估：同目录纯类型。 */
import type {MaybePromise} from "./types";
/** 用途：获取请求 ID 用于竞态控制 | 使用范围：injectReqIdMiddleware 和 createPostResponseHandler 中竞态检查 | 解耦评估：全局状态管理，无法解耦 */
import { getSiyuanReqId } from "./imports";
/** 用途：设置请求 ID 用于竞态控制 | 使用范围：injectReqIdMiddleware 中记录请求时间戳 | 解耦评估：全局状态管理，无法解耦 */
import { setSiyuanReqId } from "./imports";
/** 用途：SForge 全局状态管理 | 使用范围：请求信号量跨模块持久化 | 解耦评估：基础设施，需全局单例 */
import { getSForgeState } from "./imports";
/** 用途：SForge 全局状态写入 | 使用范围：首次创建请求信号量 | 解耦评估：由本层 imports.ts 直达类型安全注册表实现。 */
import { setSForgeState } from "./imports";
/** 用途：Model 错误处理器注册键 | 使用范围：事务请求网络故障 | 解耦评估：Symbol 是跨模块唯一身份，参数传递会破坏注册表所有权。 */
import { MODEL_HANDLERS } from "./imports";
/** 用途：请求信号量注册键 | 使用范围：全部 POST 请求并发控制 | 解耦评估：Symbol 是跨模块唯一身份，参数传递会产生分裂状态。 */
import { REQUEST_SEMAPHORE } from "./imports";
/** 用途：官方插件 POST 协议类型。使用范围：fetchPost 生态兼容重载；解耦评估：同目录完整网络类型，不依赖运行时实现。 */
import type {OfficialFetchPost} from "./types";
/** 用途：统一解析 HTTP 状态、JSON 与文本响应。使用范围：POST、回调 GET 和 Promise GET；解耦评估：同目录响应边界保持唯一实现。 */
import {handleFetchResponse} from "./http/response";
/** 用途：规范化官方与 Fetch 两类请求头。使用范围：POST 请求构造；解耦评估：与旧网络入口共享唯一转换实现。 */
import {normalizeRequestHeaders} from "./http/requestHeaders";

const maxConcurrent = 6;

/**
 * 读取或创建进程内唯一请求信号量。
 * 网络请求发起和完成时同步读取同一注册表对象，后续可迁移为独立并发调度器。
 */
function getSemaphore() {
    let s = getSForgeState(REQUEST_SEMAPHORE);
    if (!s) {
        s = { current: 0, pending: [] };
        setSForgeState(REQUEST_SEMAPHORE, s);
    }
    return s;
}

/**
 * 等待一个并发请求名额。
 * fetchPost/fetchSyncPost 在访问内核前调用，Promise 在名额可用时兑现。
 */
function acquire(){
    const s = getSemaphore();
    // 未达到并发上限时立即占用名额，避免不必要的微任务排队。
    if (s.current < maxConcurrent) {
        s.current++;
        return Promise.resolve();
    }
    return new Promise<void>(resolve => {
        s.pending.push(resolve);
    });
}

/**
 * 释放一个请求名额并唤醒最早排队的请求。
 * 每个成功获取名额的网络路径必须且只调用一次。
 */
function release() {
    const s = getSemaphore();
    s.current--;
    const next = s.pending.shift();
    if (next) {
        s.current++;
        next();
    }
}

/**
 * 将事务网络故障交给已注册的内核恢复处理器。
 * 仅在事务 API 出现可恢复连接错误时调用；缺少处理器会显式记录警告。
 */
function handleKernelError() {
    const handlers = getSForgeState(MODEL_HANDLERS);
    // 完整应用注册了恢复处理器时，由其决定重传或重启交互。
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
 *
 * 上游 15449 起将「最近更新块」与「全文搜索」改由独立的并发搜索治理层承接，
 * 不再依赖 reqId 丢弃过期响应；本分叉的语义搜索入口 semanticSearchBlock 继续保留在该机制内。
 */
const 需要竞态控制 = (url: string) => {
    return url === "/api/search/searchRefBlock" ||
        url === "/api/graph/getGraph" ||
        url === "/api/graph/getLocalGraph" ||
        url === "/api/search/semanticSearchBlock";
};


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
    // 官方插件入口历史上允许任意 data；只有对象载荷能够安全承载内部 reqId 元数据。
    if (!ctx.data || typeof ctx.data !== "object" || ctx.data instanceof FormData) {
        return;
    }

    // 对于高频搜索/图谱请求，记录请求时间戳用于后续竞态检查
    if (需要竞态控制(ctx.url)) {
        setSiyuanReqId(ctx.url, Date.now());
    }

    const isNotLocalGraph = Reflect.get(ctx.data, "type") !== "local" || ctx.url !== "/api/graph/getLocalGraph";
    const reqId = getSiyuanReqId(ctx.url);

    // 将 reqId 注入请求数据，以便响应时验证（排除 local 类型的本地图谱，因其不需要竞态控制）
    if (需要竞态控制(ctx.url) && isNotLocalGraph && reqId !== undefined) {
        Reflect.set(ctx.data, "reqId", reqId);
    }

    // 事务 API 总是需要唯一标识以保证操作顺序
    if (ctx.url === "/api/transactions") {
        Reflect.set(ctx.data, "reqId", Date.now());
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
const handleFetchError = async (options: {
    url: string;
    data: TFetchRequestData | undefined;
    error: Error;
    failCallback: ((response: IWebSocketData) => MaybePromise<void>) | undefined;
}) => {
    // 当 /api/file/getFile 请求失败且提供了 failCallback 时，优先调用 failCallback 让调用者自行处理
    // 文件获取失败是常见场景（如文件不存在），调用者可能希望静默处理而非触发通用警告日志
    if (options.failCallback && options.url === "/api/file/getFile") {
        await options.failCallback({
            data: null,
            msg: options.error.message,
            code: 400,
        });
        return;
    }
    console.warn("fetch post failed [" + options.error + "], url [" + options.url + "]");
    // 特殊处理事务 API 的网络失败或解析错误，触发内核重传或重启确认。
    if (options.url === "/api/transactions" && (options.error.message === "Failed to fetch" || options.error.message === "Unexpected end of JSON input")) {
        handleKernelError();
        return;
    }
    const dataErrorExit = options.data && typeof options.data === "object" && !(options.data instanceof FormData) ?
        Reflect.get(options.data, "errorExit") : undefined;
    const isExitCall = options.url === "/api/system/exit" || options.url === "/api/system/setWorkspaceDir" || (
        ["/api/system/setUILayout"].includes(options.url) && dataErrorExit
    );
    // 如果请求涉及系统退出或工作空间迁移，则通知 Electron 进程执行退出逻辑。
    if (isElectron && isExitCall) {
        ipcSend(Constants.SIYUAN_QUIT, location.port);
    }
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
const createPostResponseHandler = (
    url: string,
    cb?: (response: IWebSocketData) => MaybePromise<void>,
) => {
    return async (response: IWebSocketData) => {
        // 维持既有公开行为：非 JSON POST 响应按原值交给插件和内部回调。
        if (typeof response === "string") {
            await cb?.(response);
            return;
        }
        const currentReqId = getSiyuanReqId(url);
        // 执行请求竞态检查：如果接收到的响应 reqId 小于最新发送的 reqId，说明是过期的响应，应当丢弃以免覆盖新数据。
        if (需要竞态控制(url) && response.data?.reqId && currentReqId && currentReqId > response.data.reqId) {
            return;
        }
        const isMessage = isWebSocketData(response);
        // 非标准响应按原值透传；标准消息则先完整等待通用消息处理链。
        if (!isMessage) {
            await cb?.(response);
            return;
        }
        // 通用消息处理与业务回调是否存在无关；无回调请求仍可能承载重载、通知等系统命令。
        const processed = await processMessage(response, {fetchPost});
        if (!processed || !cb) {
            return;
        }
        await cb(response);
    };
};

/** 为所有 POST 入口执行同一套请求数据处理；各入口仍独立拥有自己的响应语义。 */
const createPostRequestInit = async (options: {
    url: string;
    data: TFetchRequestData | undefined;
    headers: HeadersInit | IObject | null | undefined;
    signal: AbortSignal | undefined;
}) => {
    const ctx: FetchContext = {url: options.url, data: options.data, serializedBody: null};
    injectReqIdMiddleware(ctx);
    serializeRequestDataMiddleware(ctx);
    const init: RequestInit = {method: "POST", body: ctx.serializedBody};
    const headers = await normalizeRequestHeaders(options.headers);
    if (headers) {
        init.headers = headers;
    }
    if (options.signal) {
        init.signal = options.signal;
    }
    return init;
};

/** 执行单次 POST 请求并返回已解析响应；信号量和业务回调由外层统一管理。 */
const requestPostResponse = async (options: {
    url: string;
    data: TFetchRequestData | undefined;
    headers: HeadersInit | IObject | null | undefined;
    signal: AbortSignal | undefined;
}) => {
    const init = await createPostRequestInit(options);
    const response = await fetch(options.url, init);
    // fetchPost 的既有插件协议同时透传标准消息和纯文本；严格消息校验仅属于 fetchSyncPost。
    const responseData: IWebSocketData = await handleFetchResponse(response);
    return {
        isGetFile202: response.status === 202 && options.url === "/api/file/getFile",
        responseData,
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
/** 参数顺序必须保持与官方 siyuan.fetchPost 插件 API 及现有调用方一致。 */
/** @参数豁免: 第三方接口适配 */
export function fetchPost(
    url: string,
    data?: TFetchRequestData,
    cb?: (response: IWebSocketData) => MaybePromise<void>,
    headers?: HeadersInit | IObject | null,
    failCallback?: (response: IWebSocketData) => MaybePromise<void>,
    signal?: AbortSignal,
    bypassSemaphore?: boolean,
): Promise<void>;
/** 官方插件网络契约重载，固定保持最新 siyuan 类型包定义的调用表面。 */
export function fetchPost(
    ...args: Parameters<OfficialFetchPost>
): ReturnType<OfficialFetchPost>;
/** 参数顺序必须保持与上述公开重载及既有运行时调用一致。 */
/** @参数豁免: 第三方接口适配 */
export async function fetchPost(
    url: string,
    data?: TFetchRequestData,
    cb?: (response: IWebSocketData) => MaybePromise<void>,
    headers?: HeadersInit | IObject | null,
    failCallback?: (response: IWebSocketData) => MaybePromise<void>,
    signal?: AbortSignal,
    bypassSemaphore = false,
) {
    if (!bypassSemaphore) {
        await acquire();
    }
    let released = false;
    let isGetFile202 = false;
    let responseData: IWebSocketData;
    try {
        const result = await requestPostResponse({url, data, headers, signal});
        isGetFile202 = result.isGetFile202;
        responseData = result.responseData;
        if (!bypassSemaphore) {
            release();
            released = true;
        }
    } catch (e) {
        // 请求在释放前失败时归还名额，保证等待队列不会永久阻塞。
        if (!bypassSemaphore && !released) {
            release();
        }
        // 用户主动取消不进入通用内核错误流程，但保留可观察日志。
        if (isAbortError(e)) {
            console.warn(`fetchPost aborted: ${url}`, e.message || "");
            return;
        }
        const error = e instanceof Error ? e : new Error(String(e));
        await handleFetchError({url, data, error, failCallback});
        return;
    }
    // 响应回调位于网络异常处理之外；业务回调抛错应由 fetchPost 的 Promise 向调用方传播。
    if (failCallback && url === "/api/file/getFile" && isGetFile202) {
        await failCallback(responseData);
        return;
    }
    await createPostResponseHandler(url, cb)(responseData);
}
/**
 * 发送 POST 请求到思源内核 API（Promise/async-await 风格）
 *
 * 适用于需要在异步函数中等待结果的场景。
 * 与 fetchPost 不同，此方法会自动验证响应格式并抛出异常。
 *
 * @param url - API 路径
 * @param data - 请求数据
 * @param headers - 可选的自定义请求头
 * @param options - 是否处理消息的控制项：上游 v3.8.0 新增第四个位置布尔参数（`false` 表示跳过 processMessage），
 * 本分叉拆分实现同时保留对象形式 `{processMessage?: boolean}`，两种形态在此统一解释。
 * @returns Promise，resolve 为 IWebSocketData 格式的响应
 * @throws 当响应格式不符合 IWebSocketData 时抛出异常
 *
 * @example
 * // 在 async 函数中使用
 * const response = await fetchSyncPost("/api/block/checkBlockExist", { id: blockId });
 * if (response.data) {
 *     // 块存在
 * }
 *
 * // 跳过通用消息处理（与上游位置布尔参数等价）
 * const raw = await fetchSyncPost("/api/system/oidc/validate", {pollToken}, undefined, false);
 */
export const fetchSyncPost = async (
    url: string,
    data?: TFetchRequestData,
    headers?: HeadersInit | IObject | null,
    options: boolean | {processMessage?: boolean} = {},
) => {
    // 位置布尔参数与对象选项统一解释为「是否执行 processMessage」，默认执行。
    const shouldProcessMessage = typeof options === "boolean" ? options : options.processMessage !== false;
    await acquire();
    let released = false;
    try {
        const {responseData} = await requestPostResponse({url, data, headers, signal: undefined});
        if (!isWebSocketData(responseData)) {
            throw new Error(`fetchSyncPost: 响应格式不符合预期 (url: ${url})`);
        }
        release(); 
        released = true;
        if (shouldProcessMessage) {
            await processMessage(responseData, {fetchPost});
        }
        return responseData;
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
    const init = await createPostRequestInit({url, data, headers: undefined, signal: undefined});
    const res = await fetch(url, init);
    return await res.json();
};

/** 执行一次 GET 并解析响应；回调入口和 Promise 入口共享此唯一实现。 */
const requestGetResponse = async (url: string) => {
    const response = await fetch(url);
    return await handleFetchResponse(response);
};

/**
 * 保持官方插件 API 的回调式 GET 契约。
 * @同步豁免: 遗留代码 - 官方 siyuan.fetchGet 协议要求同步返回，并在请求完成后调用既有回调。
 */
export const fetchGet = (
    url: string,
    callback: (response: IWebSocketData) => void,
) => {
    void requestGetResponse(url)
        .then((response) => {
            callback(response);
        })
        .catch((error: unknown) => {
            // 官方回调协议没有失败回调或 Promise 返回值，只能在此边界显式报告异步失败。
            console.error(`fetchGet failed: ${url}`, error);
        });
};

/**
 * 发送 GET 请求并返回尚未解释的响应载荷。
 * 调用方必须按目标资源契约使用守卫验证返回值；本层不根据 URL 猜测 JSON 结构。
 * @显式返回类型原因: 将原生 Response.json 的 any 收窄为 unknown，强制异步调用方在领域边界验证外部资源。
 */
export const fetchGetAsync = async (url: string): Promise<unknown> => await requestGetResponse(url);
