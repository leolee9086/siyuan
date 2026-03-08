/**
 * SSETextDisplay 组件类型定义
 *
 * 为SSE流式文本展示组件提供 props、emits 和内部状态的类型约束。
 */

/**
 * SSE请求的API配置
 *
 * 用途：定义SSE流式请求所需的模型和端点参数
 * 使用场景：SSETextDisplay 发起提示词生成请求时使用
 */
export interface SSEApiConfig {
    /** API密钥 */
    apiKey: string;
    /** 模型标识 */
    model: string;
    /** API端点URL */
    endpoint: string;
    /** 温度参数（0-2） */
    temperature?: number;
    /** 最大token数 */
    maxTokens?: number;
}

/**
 * SSETextDisplay 组件 Props
 *
 * 用途：定义SSE文本展示组件的输入属性
 * 使用场景：人格问卷中展示AI生成的提示词内容
 */
export interface SSETextDisplayProps {
    /** 贤者系统名称 */
    systemName: string;
    /** 提示词内容（作为user消息发送） */
    promptContent: string;
    /** API配置（必须由外部传入，禁止硬编码） */
    apiConfig: SSEApiConfig;
}

/**
 * SSETextDisplay 组件 Emits
 *
 * 用途：定义SSE文本展示组件的事件类型
 * 使用场景：生成完成后通知父组件获取结果
 */
export interface SSETextDisplayEmits {
    (e: "generationComplete", payload: { system: string; content: string }): void;
}
