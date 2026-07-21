/**
 * 用途：保存 SSE 解析器跨网络分块的文本尾部和事件计数。
 * 使用场景：consumeSSEDataStream 每次读取流块时更新。
 * 关联类型：仅属于共享 SSE data 协议解析器的内部状态。
 */
export interface SSEDataBufferState {
    buffer: string;
    eventCount: number;
}
