/**
 * streamProcessor 扩展类型定义
 *
 * 为 Trinity speak 工具解析提供模式和中间状态类型约束。
 */

/**
 * 流处理模式
 *
 * 用途：区分普通文本流解析与 Trinity speak 工具流解析。
 * 使用场景：`processStreamResponse` 第三个参数 `options.mode`。
 * 关联类型：与 `StreamProcessOptions` 联动使用。
 */
export type StreamProcessMode = "default" | "trinity-speak-tool";

/**
 * 流处理参数
 *
 * 用途：控制流解析策略。
 * 使用场景：`processStreamResponse(response, callbacks, options)`。
 * 关联类型：`mode` 由 `StreamProcessMode` 约束。
 */
export interface StreamProcessOptions {
    mode?: StreamProcessMode;
    captureToolCalls?: boolean;
}

/**
 * 工具调用增量
 *
 * 用途：承载 `delta.tool_calls` 的最小字段。
 * 使用场景：Trinity 模式下聚合函数名和 arguments 片段。
 * 关联类型：由 `ParsedChunkData.toolCalls` 承载。
 */
export interface StreamToolCallDelta {
    index: number;
    name: string;
    argumentsChunk: string;
}

/**
 * 单个 chunk 的解析结果
 *
 * 用途：统一描述从流 chunk 中提取出的文本与工具增量。
 * 使用场景：`consumeStream` 循环中分支处理。
 * 关联类型：`toolCalls` 使用 `StreamToolCallDelta[]`。
 */
export interface ParsedChunkData {
    content: string;
    toolCalls: StreamToolCallDelta[];
}

/**
 * Trinity 工具调用聚合状态
 *
 * 用途：跨 chunk 聚合工具调用函数名与参数片段。
 * 使用场景：Trinity speak 模式下解析最终 `speak.content`。
 * 关联类型：由 `mergeToolCalls` 与 `resolveSpeakContent` 读写。
 */
export interface ToolCallState {
    namesByIndex: Record<number, string>;
    argsByIndex: Record<number, string>;
    hasSpeakToolCall: boolean;
    spokenContent: string;
}
