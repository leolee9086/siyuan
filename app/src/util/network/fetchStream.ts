/**
 * 用途：定义流式HTTP请求的配置参数类型，包含URL、方法、请求头、请求体、超时和中止信号
 * 使用范围：作为 universalStreamRequest 函数的第一个参数类型，定义所有流式请求的配置接口
 * 解耦评估：无法解耦。这是公共API的类型定义，必须从统一类型文件导入以保证跨模块类型一致性。
 *   类型定义属于编译时约束，不产生运行时依赖，无需通过依赖注入等方式解耦。
 */
import type { StreamRequestConfig } from "./types";

/**
 * 用途：定义流式请求生命周期中各阶段的回调函数集合（onMessage/onDone/onError/onAbort）
 * 使用范围：作为 universalStreamRequest 函数的第二个参数类型，定义调用方如何处理流式响应事件
 * 解耦评估：无法解耦。这是公共API的类型定义，必须从统一类型文件导入以保证调用方与实现方的类型契约一致。
 *   回调函数的类型签名是API契约的核心部分，不能通过参数传递等方式解耦。
 */
import type { StreamCallbacks } from "./types";
/**
 * 用途：导入共享 SSE data 流解析器，避免通用网络层和 MAGI adapter 各自解析协议。
 * 使用范围：仅用于成功 HTTP 响应的 body 消费。
 * 解耦评估：这是无业务状态的协议工具，直接模块依赖比回调注入更清晰。
 */
import { consumeSSEDataStream } from "./sse/consumeSSEDataStream";

/**
 * 作用：准备fetch请求的headers和body参数
 * 意图：将请求参数准备逻辑独立出来，避免在主函数中处理JSON序列化等细节
 * 调用时机：在universalStreamRequest中，发起fetch请求前调用
 * 问题/改进：当前强制添加Content-Type: application/json，可能与某些API不兼容
 */
const prepareRequestParams = (
    headers: Record<string, string>,
    body: unknown,
)=> {
    const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers
    };
    
    // body为undefined时返回null以符合fetch API要求
    if (body === undefined) {
        return { headers: requestHeaders, body: null };
    }
    
    const requestBody = typeof body === "string" ? body : JSON.stringify(body);
    return { headers: requestHeaders, body: requestBody };
};

/**
 * 作用：验证HTTP响应状态并处理流数据
 * 意图：将响应处理和流读取逻辑封装，确保reader在任何情况下都能正确释放
 * 调用时机：在universalStreamRequest中，fetch成功后立即调用
 * 问题/改进：当前仅检查response.ok，不处理重定向等特殊状态码
 */
const processResponse = async (
    response: Response,
    onMessage: (data: string) => void,
    resetTimeout: () => void,
)=> {
    // HTTP状态码非2xx时抛出错误
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // response.body可能为null（如204 No Content响应）
    if (!response.body) {
        throw new Error("Response body is null");
    }

    await consumeSSEDataStream(response.body, (data) => {
        onMessage(data);
        resetTimeout();
    });
};

/**
 * 作用：判断错误是否为超时导致的AbortError
 * 意图：区分用户主动取消和超时自动取消，提供更精确的错误信息
 * 调用时机：在handleError中，当捕获到AbortError时调用
 * 问题/改进：依赖时间差判断超时可能不够精确，理想方案是在超时时设置专门的标志位
 */
const isTimeoutAbort = (lastEventTime: number, timeout: number)=> {
    const timeSinceLastEvent = Date.now() - lastEventTime;
    return timeSinceLastEvent >= timeout;
};

/**
 * 作用：统一处理各类错误并调用错误回调
 * 意图：将错误处理逻辑集中管理，避免在主函数中散布try-catch
 * 调用时机：在universalStreamRequest的catch块中调用
 * 问题/改进：当前对非Error类型的错误统一包装为"未知错误"，可能丢失原始错误信息
 */
const handleError = (
    error: unknown,
    context: {
        onError: (error: Error) => void;
        lastEventTime: number;
        timeout: number;
    },
)=> {
    // 非Error类型的异常（如throw "string"）统一包装
    if (!(error instanceof Error)) {
        context.onError(new Error("未知错误"));
        return;
    }
    
    // AbortError可能由用户取消或超时触发，需区分处理
    if (error.name === "AbortError" && isTimeoutAbort(context.lastEventTime, context.timeout)) {
        context.onError(new Error("响应超时，但已保留已有内容"));
        return;
    }
    
    context.onError(error);
};

/**
 * 作用：创建超时管理闭包，返回重置超时的函数
 * 意图：将超时逻辑封装为独立模块，通过闭包捕获timeoutId和lastEventTime状态
 * 调用时机：在universalStreamRequest开始时调用一次，返回的resetTimeout函数在每次收到数据时调用
 * 问题/改进：当前超时后仅触发错误回调，不会自动中止请求，依赖外部signal控制
 */
const createTimeoutManager = (
    timeout: number,
    onError: (error: Error) => void
)=> {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastEventTime = Date.now();
    
    // @柯里化
    const resetTimeout = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        lastEventTime = Date.now();
        // 为什么必须使用setTimeout：流式请求的超时检测需要真正的时间延迟，无法用事件或观察者替代。
        // 当服务端停止发送数据但未关闭连接时，只能通过固定时间间隔判断是否超时。
        // 延迟时间来源：由调用方通过StreamRequestConfig.timeout参数传入，默认10000ms，
        // 表示两次数据接收之间的最大允许间隔，超过此时间视为服务端无响应。
        timeoutId = setTimeout(() => {
            onError(new Error("响应超时，但已保留已有内容"));
        }, timeout);
    };
    
    // @柯里化
    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    };
    
    // @柯里化
    const getLastEventTime = () => lastEventTime;
    
    return { resetTimeout, cleanup, getLastEventTime };
};

/**
 * 作用：发起流式HTTP请求并通过回调处理SSE数据流
 * 意图：提供统一的流式请求接口，支持超时控制、取消操作和完整的生命周期回调
 * 调用时机：当需要与支持SSE协议的API通信时调用，如OpenAI streaming API
 * 问题/改进：
 *   1. 当前仅支持SSE协议，不支持其他流式协议（如WebSocket）
 *   2. 超时机制基于事件间隔而非总时长，长时间无数据会触发超时
 *   3. 返回的取消函数仅触发onAbort回调，实际取消由外部AbortSignal控制
 */
export const universalStreamRequest = async (
    request: StreamRequestConfig,
    callbacks: StreamCallbacks
) => {
    const { url, method = "POST", headers = {}, body, timeout = 10000, signal } = request;
    const { onMessage, onDone, onError, onAbort } = callbacks;
    
    // 请求已被取消，直接返回
    if (signal.aborted) {
        onError(new Error("请求已终止"));
        return null;
    }
    
    const timeoutManager = createTimeoutManager(timeout, onError);
    
    try {
        timeoutManager.resetTimeout();
        
        const { headers: requestHeaders, body: requestBody } = prepareRequestParams(headers, body);
        
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal,
        });

        await processResponse(response, onMessage, timeoutManager.resetTimeout);
        onDone();
    } catch (error) {
        handleError(error, {
            onError,
            lastEventTime: timeoutManager.getLastEventTime(),
            timeout,
        });
    } finally {
        timeoutManager.cleanup();
    }
    
    return () => {
        if (onAbort) {
            onAbort();
        }
    };
};
