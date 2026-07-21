/**
 * 用途：导入 SSE 跨分块解析状态类型。
 * 使用范围：仅用于 consumeSSEDataStream 内部状态。
 * 解耦评估：这是同目录协议类型，参数注入不会减少耦合。
 */
import type { SSEDataBufferState } from "./consumeSSEDataStream.types";

/**
 * 作用：从单个 SSE 事件块提取并合并 data 字段。
 * 意图：集中处理可选空格与多行 data，避免各调用方重复解析协议文本。
 * 调用时机：共享流消费者识别出完整事件块后调用。
 */
function readDataField(eventBlock: string) {
    const dataLines: string[] = [];
    for (const line of eventBlock.split("\n")) {
        if (!line.startsWith("data:")) {
            continue;
        }
        const value = line.slice(5);
        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
    }
    return dataLines.length > 0 ? dataLines.join("\n") : null;
}

/**
 * 作用：顺序处理缓冲区内已经完整的 SSE 事件。
 * 意图：在网络分块边界与 SSE 事件边界不一致时保留未完成尾部。
 * 调用时机：每次读取网络块以及底层流自然结束时调用。
 */
async function consumeBufferedEvents(
    state: SSEDataBufferState,
    flush: boolean,
    onData: (data: string) => void | Promise<void>,
) {
    state.buffer = state.buffer.replaceAll("\r\n", "\n");
    const blocks = state.buffer.split("\n\n");
    state.buffer = flush ? "" : (blocks.pop() ?? "");
    for (const block of blocks) {
        const data = readDataField(block);
        if (data === null) {
            continue;
        }
        if (data === "[DONE]") {
            return true;
        }
        state.eventCount += 1;
        await onData(data);
    }
    return false;
}

/**
 * 作用：顺序消费 SSE 的 data 字段并报告事件数量和结束标记。
 * 意图：让通用网络层与 MAGI adapter 共享同一个跨分块协议解析器。
 * 调用时机：fetch 获得成功且带 body 的 SSE Response 后调用。
 */
export async function consumeSSEDataStream(
    body: ReadableStream<Uint8Array>,
    onData: (data: string) => void | Promise<void>,
) {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    const state: SSEDataBufferState = {buffer: "", eventCount: 0};

    try {
        while (true) {
            const result = await reader.read();
            if (result.done) {
                state.buffer += decoder.decode();
                return {
                    eventCount: state.eventCount,
                    receivedDone: await consumeBufferedEvents(state, true, onData),
                };
            }
            state.buffer += decoder.decode(result.value, {stream: true});
            if (await consumeBufferedEvents(state, false, onData)) {
                return {eventCount: state.eventCount, receivedDone: true};
            }
        }
    } finally {
        reader.releaseLock();
    }
}
