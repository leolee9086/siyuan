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

/** SEEL运行时实例 */
export interface SEELInstance {
    name: string;
    color: string;
    icon: string;
    responseType: string;
    baseWeight: number;
    protocol: string;
    processor: WISEInstance;
    messages: Array<{ role: string; content: string }>;
    status: "standby" | "active" | "error";
    lastActive: number;
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

/** SEEL配置映射 */
export interface SEELConfigurationMap {
    melchior: SEELConfiguration;
    balthasar: SEELConfiguration;
    caspar: SEELConfiguration;
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

/** WISE实例公共接口 */
export interface WISEInstance {
    voteFor: (
        functions: Array<{ name: string; action: { toString: () => string } }>,
        descriptions: string[],
        inputs: unknown[],
        goal: string
    ) => Promise<VoteScore[]>;
    reply: (userInput: string, context?: unknown) => Promise<WISEApiResponse | null>;
    summarize: (conversation: Array<{ role: string; content: string }>) => Promise<unknown>;
    checkSync: (getSEELConfig: (name: string) => { baseWeight: number }) => SyncCheckResult;
}

/** WISE完整实例（含内部状态，供工厂函数使用） */
export interface WISEFullInstance extends WISEInstance {
    api: WISEApi;
    config: MardukValidatedConfig;
    persona: WISEPersona;
    votePrompt: string;
    replyPrompt: string;
    summarizePrompt: string;
}

/** 投票评分 */
export interface VoteScore {
    name: string;
    score: number;
}

/** 同步率检查结果 */
export interface SyncCheckResult {
    status: "synced" | "desynced";
    ratio: number;
    threshold: number;
}

/** MAGI系统状态 */
export interface MAGISystemStatus {
    online: boolean;
    leader: string;
    syncRatios: Record<string, number>;
    lastVote: VoteRecord | undefined;
}

/** 投票记录 */
export interface VoteRecord {
    timestamp: number;
    responses: Array<{ seel: string; content: string }>;
    consensus: string;
    weights: Record<string, number>;
}

/** MAGI系统事件回调 */
export interface MAGISystemCallbacks {
    onSystemReady?: () => void;
    onSystemError?: (error: Error) => void;
    onSeelError?: (data: { seel: SEELInstance; error: Error }) => void;
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

/** MockWISE实例接口 */
export interface MockWISEInstance {
    readonly loading: boolean;
    readonly connected: boolean;
    readonly messages: MockMessage[];
    readonly config: Required<MockWISEConfig> & { sseConfig: SSEConfig };
    connect: () => Promise<{ status: string; message: string }>;
    reply: (userInput: string, options?: ReplyOptions) => Promise<string | AsyncGenerator<string>>;
    voteFor: (responses: string[]) => Promise<VoteForResult>;
    getContextMessages: () => ContextMessage[];
    streamResponse: (
        prompt: string,
        systemPromptForChat: string | null,
        context?: ContextMessage[]
    ) => AsyncGenerator<string>;
    updateConfig: (newConfig: Partial<MockWISEConfig>) => void;
    appendContextMessages: (messages: ContextMessage[]) => void;
    replaceLatestAssistantContextMessage: (content: string) => void;
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

/** Function Call构建器参数 */
export interface FunctionCallOptions {
    context?: string;
    reference?: string;
}

/** Function Call参数定义 */
export interface FunctionCallParameterDef {
    type: string;
    description: string;
}

/** Function Call构建结果 */
export interface FunctionCallResult {
    description: string;
    call: (args: Record<string, unknown>) => { name: string; arguments: Record<string, unknown> };
    meta: {
        name: string;
        description: string;
        context: string | undefined;
        reference: string | undefined;
        parameters: Record<string, FunctionCallParameterDef>;
    };
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

/** NERV同步状态 */
export interface NERVSyncStatus {
    status: "synced" | "desynced" | "error";
    ratio: number;
    confidence?: number;
    lastExecution?: number;
}

/** NERV工作流结果 */
export interface NERVWorkflowResult {
    summary: Array<{ persona: string; confidence: number; timestamp: number | undefined }>;
    consensus: Record<string, { score: number; weight: number }>;
    timestamp: number;
    averageConfidence: number;
}

/** 技术可行性评估结果 */
export interface TechnicalAssessment {
    difficulty: number;
    dependencies: string[];
    resourceCost: number;
}

/** 情感分析结果 */
export interface EmotionProfile {
    emotion: string;
    intensity: number;
    needs: string[];
}

/** 合规性检查结果 */
export interface ComplianceResult {
    legal: boolean;
    ethical: boolean;
    risks: string[];
}

/** 风险矩阵评估项 */
export interface RiskMatrixItem {
    probability: number;
    impact: number;
}

/** Melchior扩展实例（逻辑分析型） */
export interface MelchiorInstance extends WISEFullInstance {
    technicalAssessment: (func: unknown) => Promise<TechnicalAssessment>;
    compareSolutions: (solutions: unknown[]) => Promise<TechnicalAssessment[]>;
}

/** Balthazar扩展实例（情感共鸣型） */
export interface BalthazarInstance extends WISEFullInstance {
    analyzeEmotion: (response: WISEApiResponse) => Promise<EmotionProfile>;
    generateEmpatheticResponse: (emotionProfile: EmotionProfile) => Promise<WISEApiResponse>;
}

/** Casper扩展实例（常理判断型） */
export interface CasperInstance extends WISEFullInstance {
    checkCompliance: (input: unknown) => Promise<ComplianceResult>;
    riskMatrixAssessment: (risks: Array<{ name: string }>) => Promise<RiskMatrixItem[]>;
}

/** NERV事件回调 */
export interface NERVCallbacks {
    onPersonaCreated?: (data: { name: string; traits: unknown }) => void;
    onPersonaActivated?: (data: { name: string; mode: string; report: unknown }) => void;
    onPersonaDeactivated?: (data: { name: string }) => void;
    onPersonaExpired?: (data: { name: string; inactiveTime: number }) => void;
    onPersonaRebalanced?: (data: { name: string }) => void;
    onSyncUpdate?: (data: { name: string } & NERVSyncStatus) => void;
    onWorkflowTerminated?: (data: { name: string; reason: string | undefined; position: number }) => void;
    onWorkflowCompleted?: (data: { task: unknown; results: NERVWorkflowResult; executionTime: number }) => void;
    onError?: (data: { type: string; error: Error; [key: string]: unknown }) => void;
}
