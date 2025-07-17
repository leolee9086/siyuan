import {Constants} from "../constants";
/// #if !BROWSER
import {ipcRenderer} from "electron";
/// #endif
import {processMessage} from "./processMessage";
import {kernelError} from "../dialog/processSystem";

export const fetchPost = (url: string, data?: any, cb?: (response: IWebSocketData) => void, headers?: IObject) => {
    const init: RequestInit = {
        method: "POST",
    };
    if (data) {
        if (["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"].includes(url)) {
            window.siyuan.reqIds[url] = new Date().getTime();
            if (data.type === "local" && url === "/api/graph/getLocalGraph") {
                // 当打开文档A的关系图、关系图、文档A后刷新，由于防止请求重复处理，文档A关系图无法渲染。
            } else {
                data.reqId = window.siyuan.reqIds[url];
            }
        }
        // 并发导出后端接受顺序不一致
        if (url === "/api/transactions") {
            data.reqId = new Date().getTime();
        }
        if (data instanceof FormData) {
            init.body = data;
        } else {
            init.body = JSON.stringify(data);
        }
    }
    if (headers) {
        init.headers = headers;
    }
    fetch(url, init).then((response) => {
        switch (response.status) {
            case 403:
            case 404:
                return {
                    data: null,
                    msg: response.statusText,
                    code: -response.status,
                };
            default:
                if (401 == response.status) {
                    // 返回鉴权失败的话直接刷新页面，避免用户在当前页面操作 https://github.com/siyuan-note/siyuan/issues/15163
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                }

                if (response.headers.get("content-type")?.indexOf("application/json") > -1) {
                    return response.json();
                } else {
                    return response.text();
                }
        }
    }).then((response: IWebSocketData) => {
        if (typeof response === "string") {
            if (cb) {
                cb(response);
            }
            return;
        }
        if (["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"].includes(url)) {
            if (response.data.reqId && window.siyuan.reqIds[url] && window.siyuan.reqIds[url] > response.data.reqId) {
                return;
            }
        }
        if (typeof response === "object" && typeof response.msg === "string" && typeof response.code === "number") {
            if (processMessage(response) && cb) {
                cb(response);
            }
        } else if (cb) {
            cb(response);
        }
    }).catch((e) => {
        console.warn("fetch post failed [" + e + "], url [" + url + "]");
        if (url === "/api/transactions" && (e.message === "Failed to fetch" || e.message === "Unexpected end of JSON input")) {
            kernelError();
            return;
        }
        /// #if !BROWSER
        if (url === "/api/system/exit" || url === "/api/system/setWorkspaceDir" || (
            ["/api/system/setUILayout"].includes(url) && data.errorExit // 内核中断，点关闭处理
        )) {
            ipcRenderer.send(Constants.SIYUAN_QUIT, location.port);
        }
        /// #endif
    });
};

export const fetchSyncPost = async (url: string, data?: any) => {
    const init: RequestInit = {
        method: "POST",
    };
    if (data) {
        if (data instanceof FormData) {
            init.body = data;
        } else {
            init.body = JSON.stringify(data);
        }
    }
    const res = await fetch(url, init);
    const res2 = await res.json() as IWebSocketData;
    processMessage(res2);
    return res2;
};

export const fetchGet = (url: string, cb: (response: IWebSocketData | IObject | string) => void) => {
    fetch(url).then((response) => {
        if (response.headers.get("content-type")?.indexOf("application/json") > -1) {
            return response.json();
        } else {
            return response.text();
        }
    }).then((response) => {
        cb(response);
    });
};

export const fetchStream = async (params: any, onMessage: (content: string) => void, onDone: () => void, onError: (error: Error) => void, onAbort?: () => void) => {
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
        }, 10000); // 10秒无事件则超时
    };
    
    try {
        // 创建可取消的请求
        controller = new AbortController();
        
        // 初始超时设置
        resetTimeout();
        
        const response = await fetch("/api/ai/chatGPT", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
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
        let isFirstChunk = true;

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
                            return; // 流结束
                        }
                        
                        try {
                            const data = JSON.parse(dataStr) as { content?: string; status?: string; error?: string; message?: string };
                            
                            // 处理错误
                            if (data.error) {
                                onError(new Error(data.error));
                                return;
                            }
                            
                            // 处理状态消息
                            if (data.status && data.message) {
                                console.log(`AI Status: ${data.status} - ${data.message}`);
                                resetTimeout(); // 重置超时
                                continue;
                            }
                            
                            // 处理内容
                            if (data.content) {
                                // 第一个chunk可能需要特殊处理
                                if (isFirstChunk && data.content.trim() === "") {
                                    continue; // 跳过空的第一个chunk
                                }
                                isFirstChunk = false;
                                onMessage(data.content);
                                resetTimeout(); // 每次收到内容都重置超时
                            }
                        } catch (e) {
                            // 忽略JSON解析错误，继续处理下一个事件
                            console.warn("Failed to parse SSE data:", dataStr);
                        }
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
                if (timeSinceLastEvent >= 10000) {
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
