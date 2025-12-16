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
    apiProxy: string;
    apiTemperature: number;
    apiTimeout: number;
    apiUserAgent: string;
    apiVersion?: string|undefined;
}

/**
 * AI配置的Zod验证模式
 */
export const aiConfigSchema = z.object({
    apiBaseURL: z.string().url("API基础URL格式不正确"),
    apiKey: z.string().min(1, "API密钥不能为空"),
    apiMaxContexts: z.number().min(1, "最大上下文数必须大于0"),
    apiMaxTokens: z.number().min(0, "最大令牌数不能为负数"),
    apiModel: z.string().min(1, "模型名称不能为空"),
    apiProvider: z.string().min(1, "API提供商不能为空"),
    apiProxy: z.string(),
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
    id?: string;
    created?: number;
    model?: string;
    choices?: Array<{
        index?: number;
        delta?: {
            content?: string;
            reasoning_content?: string;
            role?: string;
        };
        message?: {
            content?: string;
            reasoning_content?: string;
            role?: string;
        };
        finish_reason?: string;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: {
            cached_tokens?: number;
        };
    };
    error?: {
        message: string;
        type?: string;
        code?: string;
    };
}

/**
 * 聊天响应数据的Zod验证模式
 */
export const chatResponseDataSchema = z.object({
    id: z.string().optional(),
    created: z.number().optional(),
    model: z.string().optional(),
    choices: z.array(z.object({
        index: z.number().optional(),
        delta: z.object({
            content: z.string().optional(),
            reasoning_content: z.string().optional(),
            role: z.string().optional(),
        }).optional(),
        message: z.object({
            content: z.string().optional(),
            reasoning_content: z.string().optional(),
            role: z.string().optional(),
        }).optional(),
        finish_reason: z.string().optional(),
    })).optional(),
    usage: z.object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
        prompt_tokens_details: z.object({
            cached_tokens: z.number().optional(),
        }).optional(),
    }).optional(),
    error: z.object({
        message: z.string(),
        type: z.string().optional(),
        code: z.string().optional(),
    }).optional(),
});

/**
 * 流式请求配置接口（扩展原有接口）
 */
export interface StreamRequestConfigWithAI {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
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
    const parsedConfig= aiConfigSchema.parse(config);
    if(parsedConfig.apiMaxTokens===0){
        parsedConfig.apiMaxTokens=163840;
    }
    if(parsedConfig.apiProxy===undefined){
        parsedConfig.apiProxy="";
    }
    return parsedConfig;
};

export const selectorOperationConfigSchema = z.object({
    /** 选择器字符串，用于选择元素 */
    selector: z.string().min(1, "选择器不能为空"),
    /** 过滤函数，返回true保留元素，false过滤掉 */
    filterFn: z.function()
        .input([z.instanceof(Element), z.number(),z.array(z.instanceof(Element))])
        .output(z.boolean())
        .optional(),
    /** 对每个元素执行的操作函数 */
    eachFn: z.function()
        .input([z.instanceof(Element), z.number(), z.array(z.instanceof(Element))])
        .output(z.void()),
    /** 所有操作完成后的回调函数 */
    completeFn: z.function()
        .input()
        .output(z.void())
        .optional(),
});

/**
 * 选择器操作配置接口（从zod schema推断）
 */
export type SelectorOperationConfig = z.infer<typeof selectorOperationConfigSchema>;