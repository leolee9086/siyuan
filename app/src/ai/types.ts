import { z } from "zod";
/** 用途：描述 AI 菜单上下文可使用的菜单能力；使用范围：AI 动作构建流程；解耦评估：依赖插件菜单领域契约，不引用具体队列和 DOM 封装 class。 */
import type {IPluginMenu} from "../plugin/menu/menu.types";

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
    user?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: Array<Record<string, unknown>>;
    tool_choice?: "none" | "auto" | "required" | Record<string, unknown>;
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
    /** Renderer-only search targets returned beside the OpenAI response. */
    webSearchLinks?: Record<string, string>;
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
    webSearchLinks: z.record(z.string(), z.string()).optional(),
    error: z.object({
        message: z.string(),
        type: z.string().optional(),
        code: z.string().optional(),
    }).optional(),
});




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

/**
 * AI动作配置项的Zod验证模式
 */
export const aiActionConfigSchema = z.object({
    name: z.string().min(1, "动作名称不能为空"),
    memo: z.string().min(1, "动作描述不能为空")
});

/**
 * AI动作配置项类型（从zod schema推断）
 */
export type AiActionConfig = z.infer<typeof aiActionConfigSchema>;

/**
 * AI动作存储上下文接口
 */
export interface AiActionStorageContext {
    /**
     * 获取AI动作配置列表
     */
    getAiActions(): AiActionConfig[];

    /**
     * 设置AI动作配置列表
     */
    setAiActions(actions: AiActionConfig[]): void;

    /**
     * 保存AI动作配置到存储
     */
    saveAiActions(): void;
}

/**
 * AI菜单上下文接口
 */
export interface AIMenuContext {
    protyle: IProtyle;
    ids: string[];
    elements: Element[];
    menu: IPluginMenu;
    clearContext: string;
}

/**
 * AI菜单请求接口
 */
export interface AIMenuRequest {
    target: HTMLElement | SVGElement;
    element: HTMLElement;
    event: Event;
}
