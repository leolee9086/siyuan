/** 用途：约束会话事件；使用范围：完整 SSE frame 的解析结果。 */
import type {AgentConversationSessionEvent} from "../../runtime/conversation/agentConversation.types";
/** 用途：约束长生命周期订阅；使用范围：网络读取与回调提交。 */
import type {AgentConversationSubscription} from "../../runtime/conversation/agentConversation.types";
/** 用途：校验会话事件公共元数据；使用范围：JSON data 边界；解耦评估：守卫是同协议纯函数，无需注入。 */
import {readAgentConversationSessionEvent} from "./AgentConversationControl.guard";
/** 用途：约束增量 SSE frame；使用范围：逐行解析。 */
import type {AgentConversationEventFrame} from "./AgentConversationControl.types";

/** 将一个完整 SSE frame 解析为带公共元数据的会话事件。 */
/** @显式返回类型原因 SSE frame 允许注释心跳，因此必须用 null 表示没有业务事件。 */
function parseEventFrame(frameText: string): AgentConversationSessionEvent | null {
    const frame: AgentConversationEventFrame = {event: "", id: "", data: []};
    for (const rawLine of frameText.split(/\r?\n/u)) {
        const separator = rawLine.indexOf(":");
        const field = separator < 0 ? rawLine : rawLine.slice(0, separator);
        const value = separator < 0 ? "" : rawLine.slice(separator + 1).replace(/^ /u, "");
        // event 字段声明当前 frame 的业务事件类型。
        if (field === "event") {
            frame.event = value;
            continue;
        }
        // id 字段提供断线恢复所需的单调游标。
        if (field === "id") {
            frame.id = value;
            continue;
        }
        // data 字段允许多行，完整 frame 结束后再统一 JSON 解析。
        if (field === "data") {
            frame.data.push(value);
        }
    }
    // 心跳和注释帧没有 data 字段，不进入业务事件流。
    if (frame.data.length === 0) {
        return null;
    }
    const parsed: unknown = JSON.parse(frame.data.join("\n"));
    const event = readAgentConversationSessionEvent(parsed, frame.event, Number.parseInt(frame.id, 10));
    // 缺少公共元数据的事件会破坏游标恢复，立即终止订阅并进入重连。
    if (!event) {
        throw new Error("Agent session event is missing required metadata");
    }
    return event;
}

/** 从增量文本中顺序提交所有完整 SSE frame。 */
async function consumeEventFrames(
    buffer: string,
    onEvent: AgentConversationSubscription["onEvent"],
) {
    const frames = buffer.split(/\r?\n\r?\n/u);
    const remainder = frames.pop() || "";
    for (const frameText of frames) {
        const event = parseEventFrame(frameText);
        if (event) {
            await onEvent(event);
        }
    }
    return remainder;
}

/** 读取一个长生命周期会话事件流，直到服务端关闭或调用方中止。 */
async function consumeAgentConversationEvents(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: AgentConversationSubscription["onEvent"],
) {
    const decoder = new TextDecoder("utf-8", {fatal: true});
    let buffer = "";
    while (true) {
        const result = await reader.read();
        if (result.done) {
            break;
        }
        buffer += decoder.decode(result.value, {stream: true});
        buffer = await consumeEventFrames(buffer, onEvent);
    }
    buffer += decoder.decode();
    const finalEvent = parseEventFrame(buffer.trim());
    if (finalEvent) {
        await onEvent(finalEvent);
    }
}

/** 建立带 owner capability 的 native Agent 会话事件订阅。 */
export async function subscribeAgentConversationEvents(subscription: AgentConversationSubscription) {
    const query = new URLSearchParams({
        sessionID: subscription.sessionID,
        after: String(subscription.after),
    });
    const response = await fetch(`/api/ai/agent/events?${query.toString()}`, {
        method: "GET",
        headers: subscription.requestHeaders({scope: "app"}),
        signal: subscription.signal,
    });
    if (!response.ok) {
        throw new Error(`Agent session event request failed: ${response.status}`);
    }
    if (!response.headers.get("Content-Type")?.includes("text/event-stream") || !response.body) {
        throw new Error("Agent session event response is not an SSE stream");
    }
    await consumeAgentConversationEvents(response.body.getReader(), subscription.onEvent);
}
