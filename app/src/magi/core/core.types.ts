/**
 * @fileoverview MAGI核心系统类型定义
 * @description 覆盖SEEL配置、Marduk协议、WISE处理器、NERV人格系统等核心类型
 */

/** SEEL基础配置 */
export interface SEELConfiguration {
    name: string;
    color: string;
    icon: string;
    responseType: string;
    baseWeight: number;
}

/** SEEL配置（含协议标记） */
export interface SEELConfigWithProtocol extends SEELConfiguration {
    protocol: string;
}



/** Marduk验证后的配置 */
export interface MardukValidatedConfig {
    apiKey: string;
    baseURL: string;
    model: string;
    timeout: number;
    maxTokens: number;
    temperature: number;
    _meta?: ConfigMeta;
}

/** 配置元数据 */
export interface ConfigMeta {
    source?: string;
    loadedAt?: Date;
    isDefault?: boolean;
}



/** WISE API接口 */
export interface WISEApi {
    post: (params: WISEApiPostParams) => Promise<WISEApiResponse>;
    successRate?: number;
    averageLatency?: number;
}

/** WISE API请求参数 */
export interface WISEApiPostParams {
    model: string;
    messages: Array<{ role: string; content: string }>;
}

/** WISE API响应 */
export interface WISEApiResponse {
    choices: Array<{
        message: { content: string };
    }>;
}

/** WISE人格配置 */
export interface WISEPersona {
    name: string;
    color: string;
    icon: string;
    responseType: string;
    bootPrompts?: { content: string };
}




/** 投票评分 */
export interface VoteScore {
    name: string;
    score: number;
}



/** OpenAI兼容配置 */
export interface OpenAICompatConfig {
    apiKey: string;
    model: string;
    base_url: string;
    temperature: number;
    max_tokens: number;
    context_window?: number;
}

/** SSE配置 */
export interface SSEConfig {
    eventTypes: string[];
    chunkInterval: number;
}

/** MockWISE配置 */
export interface MockWISEConfig {
    magiInstanceName?: string;
    name?: string;
    displayName?: string;
    color?: string;
    icon?: string;
    responseType?: string;
    persona?: string;
    sseConfig?: Partial<SSEConfig>;
    openAIConfig?: Partial<OpenAICompatConfig>;
    systemPromptForChat?: string;
    memorySize?: number;
}

/** MockWISE消息 */
export interface MockMessage {
    type: "user" | "ai" | "vote";
    content?: string;
    status?: "loading" | "success" | "error";
    timestamp: number;
    meta?: Record<string, unknown>;
}


/** 上下文消息 */
export interface ContextMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
}

/** 回复选项 */
export interface ReplyOptions {
    context?: {
        userInput?: string;
        responses?: Array<{ seel: string; content: string }>;
        introspection?: string;
        overrideMessages?: ContextMessage[];
    };
    tools?: Array<Record<string, unknown>>;
    toolChoice?: "none" | "auto" | "required" | Record<string, unknown>;
}

/** 投票结果 */
export interface VoteForResult {
    error?: boolean;
    message?: string;
    melchior: "批准" | "否决";
    balthazar: "批准" | "否决";
    casper: "批准" | "否决";
    passed: boolean;
    round: number;
}

/** 文件系统抽象接口 */
export interface FileSystemAdapter {
    readDir: (path: string) => Promise<Array<{ name: string }>>;
    readFile: (path: string) => Promise<string>;
}

/** 配置加载器依赖 */
export interface ConfigLoaderDeps {
    fs: FileSystemAdapter;
    dataStoragePath: string;
}

/** 函数信息条目（用于投票格式化） */
export interface FunctionInfoEntry {
    name: string;
    content: string;
    description: string;
    input: string;
    goal: string;
}





/** NERV Ghost容器 */
export interface NERVGhost {
    core: {
        Persona: PersonaTraits;
        execute: (task: unknown, context: unknown) => Promise<NERVExecutionResult>;
        getStatus: () => { confidence: number; lastExecution: number };
        meta: { created: number; version: string; dependencies: string[] };
    };
    state: "inactive" | "active";
    activationCount: number;
    lastUsed: number | null;
    config: Record<string, unknown>;
}

/** 人格特质 */
export interface PersonaTraits {
    personalityTraits: Record<string, number>;
    splitPersona?: () => [PersonaTraits, PersonaTraits];
}

/** NERV执行结果 */
export interface NERVExecutionResult {
    confidence?: number;
    timestamp?: number;
    terminate?: boolean;
    terminateReason?: string;
    recommendations?: Record<string, { score: number; weight?: number }>;
    [key: string]: unknown;
}



