
// 定义流式请求配置的类型（保持向后兼容）
interface StreamRequestConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number; // 默认10秒
}

// 定义回调函数类型
interface StreamCallbacks {
    onMessage: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onAbort?: () => void;
}

// 新的通用流式请求函数
export const universalStreamRequest = async (
    request: StreamRequestConfig,
    callbacks: StreamCallbacks
) => {
    const { url, method = "POST", headers = {}, body, timeout = 10000 } = request;
    const { onMessage, onDone, onError, onAbort } = callbacks;
    
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let lastEventTime = Date.now();
    
    const resetTimeout = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        lastEventTime = Date.now();
        // 每个事件后重置超时计时器
        timeoutId = setTimeout(() => {
            if (controller) {
                controller.abort();
            }
        }, timeout);
    };
    
    try {
        // 创建可取消的请求
        controller = new AbortController();
        
        // 初始超时设置
        resetTimeout();
        
        // 准备请求头
        const requestHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            ...headers
        };
        
        // 准备请求体
        let requestBody: string | undefined;
        if (body !== undefined) {
            requestBody = typeof body === 'string' ? body : JSON.stringify(body);
        }
        
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Response body is null");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || ""; // 保留不完整的事件

                for (const event of events) {
                    if (event.startsWith("data: ")) {
                        const dataStr = event.substring(6);
                        
                        // 处理特殊事件
                        if (dataStr === "[DONE]") {
                            onDone(); // 调用结束回调
                            return; // 流结束
                        }
                        console.log(dataStr)
                        // 直接传递原始数据给调用方处理
                        onMessage(dataStr);
                        resetTimeout(); // 每次收到内容都重置超时
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        onDone();
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                // 检查是否是因为超时
                const timeSinceLastEvent = Date.now() - lastEventTime;
                if (timeSinceLastEvent >= timeout) {
                    onError(new Error("响应超时，但已保留已有内容"));
                } else {
                    onError(new Error("请求已终止"));
                }
            } else {
                onError(error);
            }
        } else {
            onError(new Error("未知错误"));
        }
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
    
    // 返回终止函数，供外部调用
    return () => {
        if (controller) {
            controller.abort();
        }
        if (onAbort) {
            onAbort();
        }
    };
};