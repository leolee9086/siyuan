/** 用途：创建请求专属文本解码器；使用范围：SSE 分块读取；解耦评估：对象实例化集中在同一领域工厂。 */
import {createAgentSSEDecoder} from "./agentSSE.error.factory";
/** 用途：校验并解析单帧协议事件；使用范围：data 行分派；解耦评估：同一 SSE 领域直接依赖协议守卫。 */
import {parseAgentSSEEvent} from "./agentSSE.parser.guard";
/** 用途：约束完整请求回调；使用范围：事件顺序提交；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {AgentSSERequest} from "./agentSSE.types";
/** 用途：约束增量解码状态；使用范围：读取、行解析和尾部刷新；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {AgentSSEStreamState} from "./agentSSE.types";
/** 用途：约束已校验协议事件；使用范围：终止状态识别；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {ISSEResult} from "./agentSSE.types";

/** 判断一帧是否明确结束当前 Agent 轮次。 */
function isTerminalAgentSSEEvent(event: ISSEResult) {
    return event.type === "done" || event.type === "error" || event.type === "interrupted";
}

/** 解析并按到达顺序提交一个 data 行，同时更新终止状态。 */
async function emitAgentSSEData(
    state: AgentSSEStreamState,
    payload: string,
    onEvent: AgentSSERequest["onEvent"],
) {
    if (!state.currentEvent || !payload) {
        return;
    }
    const event = parseAgentSSEEvent(state.currentEvent, payload);
    await onEvent(event);
    state.terminalReceived = state.terminalReceived || isTerminalAgentSSEEvent(event);
    state.currentEvent = "";
}

/** 消费一个已解码行；event 行更新类型，data 行完成事件提交。 */
async function consumeAgentSSELine(
    state: AgentSSEStreamState,
    line: string,
    onEvent: AgentSSERequest["onEvent"],
) {
    // event 行只更新下一条 data 所属的协议事件名。
    if (line.startsWith("event:")) {
        state.currentEvent = line.slice(6).trim();
        return;
    }
    // data 行在已知 event 上下文中完成解析和顺序提交。
    if (line.startsWith("data:")) {
        await emitAgentSSEData(state, line.slice(5).trim(), onEvent);
    }
}

/** 从增量缓冲区提取完整行，并保留尚未闭合的尾部。 */
async function consumeAgentSSEBuffer(state: AgentSSEStreamState, onEvent: AgentSSERequest["onEvent"]) {
    const lines = state.buffer.split("\n");
    state.buffer = lines.pop() || "";
    for (const line of lines) {
        await consumeAgentSSELine(state, line, onEvent);
    }
}

/** 刷新解码器和最后一个未换行 data 行。 */
async function flushAgentSSEBuffer(
    state: AgentSSEStreamState,
    decoder: TextDecoder,
    onEvent: AgentSSERequest["onEvent"],
) {
    state.buffer += decoder.decode();
    const line = state.buffer.trim();
    // reader 结束时最后一个 data 行可能没有换行，需要显式刷新。
    if (line.startsWith("data:")) {
        await emitAgentSSEData(state, line.slice(5).trim(), onEvent);
    }
}

/** 顺序读取响应流，直到 reader 结束，并返回是否收到终止事件。 */
export async function consumeAgentSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: AgentSSERequest["onEvent"],
) {
    const decoder = createAgentSSEDecoder();
    const state: AgentSSEStreamState = {buffer: "", currentEvent: "", terminalReceived: false};
    while (true) {
        const readResult = await reader.read();
        if (readResult.done) {
            break;
        }
        state.buffer += decoder.decode(readResult.value, {stream: true});
        await consumeAgentSSEBuffer(state, onEvent);
    }
    await flushAgentSSEBuffer(state, decoder, onEvent);
    return state.terminalReceived;
}
