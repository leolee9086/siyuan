/**
 * 流式请求配置接口
 */
export interface StreamRequestConfig {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers: Record<string, string>;
    body: string;
    timeout: number;
    signal: AbortSignal;
}

/**
 * 思源AI配置接口
 */
export interface SiyuanAIConfig {
    openAI: {
        apiModel: string;
        apiTemperature: number;
        apiMaxTokens: number;
        apiUserAgent: string;
        apiKey: string;
        apiBaseURL: string;
        apiTimeout: number;
        apiVersion?: string;
    };
}

/**
 * 消息回调函数类型
 */
export type OnMessageCallback = ((content: string, getCurrentContent?: () => string) => void) & {
    getResponseContentRef?: () => { textContent: string };
};
