import { z } from "zod";

/**
 * AI配置接口定义
 */
export interface AIConfig {
    apiBaseURL: string;
    apiKey: string;
    apiMaxContexts: number;
    apiMaxTokens: number;
    apiModel: string;
    apiProvider: string;
    apiProxy?: string;
    apiTemperature: number;
    apiTimeout: number;
    apiUserAgent: string;
    apiVersion?: string;
}

/**
 * AI配置的Zod验证模式
 */
export const aiConfigSchema = z.object({
    apiBaseURL: z.string().url("API基础URL格式不正确"),
    apiKey: z.string().min(1, "API密钥不能为空"),
    apiMaxContexts: z.number().min(1, "最大上下文数必须大于0"),
    apiMaxTokens: z.number().min(1, "最大令牌数必须大于0"),
    apiModel: z.string().min(1, "模型名称不能为空"),
    apiProvider: z.string().min(1, "API提供商不能为空"),
    apiProxy: z.string().optional(),
    apiTemperature: z.number().min(0).max(2, "温度值必须在0-2之间"),
    apiTimeout: z.number().min(1, "超时时间必须大于1秒"),
    apiUserAgent: z.string().min(1, "用户代理不能为空"),
    apiVersion: z.string().optional(),
});

/**
 * 聊天请求参数接口
 */
export interface ChatRequestParams {
    messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
    }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

/**
 * 聊天响应数据接口
 */
export interface ChatResponseData {
    choices?: Array<{
        delta?: {
            content?: string;
        };
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message: string;
        type?: string;
        code?: string;
    };
}

/**
 * 流式请求配置接口（扩展原有接口）
 */
export interface StreamRequestConfigWithAI {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    // 新增AI配置支持
    aiConfig?: AIConfig;
}

/**
 * AI服务提供商类型
 */
export type AIProvider = "OpenAI" | "ZhipuAI" | "BaiduWenxin" | "AliTongyi" | string;



/**
 * 验证AI配置
 */
export const validateAIConfig = (config: unknown): AIConfig => {
    return aiConfigSchema.parse(config);
};

/**
 * 从思源配置中获取AI配置
 */
export const getAIConfigFromSiyuan = (): AIConfig => {
    const siyuanConfig = window.siyuan?.config?.ai?.openAI;
    if (!siyuanConfig) {
        throw new Error("未找到思源AI配置，请检查配置文件");
    }
    
    // 思源配置中的超时时间是秒，需要转换为毫秒
    const configWithConvertedTimeout = {
        ...siyuanConfig,
        apiTimeout: siyuanConfig.apiTimeout * 1000
    };
    
    return validateAIConfig(configWithConvertedTimeout);
};