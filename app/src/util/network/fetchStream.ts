
import type { StreamCallbacks, StreamProcessContext, StreamRequestConfig } from "./fetchStream.types";



// 处理流数据的独立函数 - 标准形式
const processStreamData = async (
    ctx: StreamProcessContext,
): Promise<void> => {
    let buffer = "";
    
    while (true) {
        const { done, value } = await ctx.reader.read();
        if (done) {
            break;
        }

        buffer += ctx.decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // 保留不完整的事件

        for (const event of events) {
            if (!event.startsWith("data: ")) {
                continue;
            }
            
            const dataStr = event.substring(6);
            
            // 处理特殊事件
            if (dataStr === "[DONE]") {
                ctx.onDone(); // 调用结束回调
                return; // 流结束
            }
            
            // 直接传递原始数据给调用方处理
            ctx.onMessage(dataStr);
            ctx.resetTimeout(); // 每次收到内容都重置超时
        }
    }
};

// 准备请求参数的独立函数
const prepareRequestParams = (
    headers: Record<string, string>,
    body: any,
): { headers: Record<string, string>; body: string | undefined } => {
    // 准备请求头
    const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers
    };
    
    // 准备请求体
    let requestBody: string | undefined;
    if (body !== undefined) {
        requestBody = typeof body === "string" ? body : JSON.stringify(body);
    }
    
    return { headers: requestHeaders, body: requestBody };
};

// 处理响应的独立函数 - 标准形式
const processResponse = async (
    ctx: StreamProcessContext,
    response:Response
): Promise<void> => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
  

    try {
        await processStreamData(ctx);
    } finally {
        ctx.reader.releaseLock();
    }
};

// 处理错误的独立函数
const handleError = (
    error: unknown,
    onError: (error: Error) => void,
    lastEventTime: number,
    timeout: number
): void => {
    if (error instanceof Error) {
        if (error.name === "AbortError") {
            // 检查是否是因为超时
            const timeSinceLastEvent = Date.now() - lastEventTime;
            if (timeSinceLastEvent >= timeout) {
                onError(new Error("响应超时，但已保留已有内容"));
            } else {
                onError(error);
            }
        } else {
            onError(error);
        }
    } else {
        onError(new Error("未知错误"));
    }
};

// 新的通用流式请求函数
export const universalStreamRequest = async (
    request: StreamRequestConfig,
    callbacks: StreamCallbacks
) => {
    const { url, method = "POST", headers = {}, body, timeout = 10000, signal } = request;
    const { onMessage, onDone, onError, onAbort } = callbacks;
    let timeoutId: NodeJS.Timeout | null = null;
    let lastEventTime = Date.now();
    // 检查信号是否已经被中止
    if (signal.aborted) {
        onError(new Error("请求已终止"));
        return null;
    }
    const resetTimeout = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        lastEventTime = Date.now();
        // 每个事件后重置超时计时器
        timeoutId = setTimeout(() => {
            // 超时时通过错误回调处理，不直接控制 signal
            onError(new Error("响应超时，但已保留已有内容"));
        }, timeout);
    };
    try {
        // 初始超时设置
        resetTimeout();
        
        // 准备请求参数
        const { headers: requestHeaders, body: requestBody } = prepareRequestParams(headers, body);
        
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal,
        });

        // 创建流处理上下文
        const streamCtx: StreamProcessContext = {
            reader: response.body?.getReader()!,
            decoder: new TextDecoder("utf-8"),
            onMessage,
            onDone,
            resetTimeout
        };
        
        await processResponse(streamCtx,  response );
        onDone();
    } catch (error) {
        handleError(error, onError, lastEventTime, timeout);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
    
    // 返回空函数，因为取消操作完全由外部 AbortSignal 控制
    return () => {
        if (onAbort) {
            onAbort();
        }
    };
};