/**
 * 流式响应解析结果
 *
 * 用途：表示单条SSE消息解析后的结构化结果
 * 使用场景：handleOpenAILikeStreamResponse 的返回值，供调用方根据结果更新状态
 */
export interface StreamResponseResult {
    content: string | null;
    isFinished: boolean;
    error?: Error;
}
