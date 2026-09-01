import type {AgentChatRuntime} from "./imports";
import type {AgentToolCall} from "./imports";
import type {SessionEntry} from "./imports";
import type {AgentSession} from "./imports";
import {deserializeSessionEntry} from "./AgentChat.sessionRender.helpers";
import {renderLoadedSessionEntry} from "./AgentChat.sessionRender.helpers";
import {resetWebReferenceIndex} from "./AgentChat.persisted.methods";
import {buildAgentPresentationEntries} from "../history/AgentHistory.presentation";

/** 将持久化条目重新渲染到当前消息容器。 */
export function renderLoadedSession(runtime: AgentChatRuntime, session: AgentSession) {
    runtime.editingUserEntryID = "";
    resetWebReferenceIndex(runtime);
    const entries = buildAgentPresentationEntries(session.entries || []);
    for (const entry of entries) {
        renderLoadedSessionEntry(
            runtime,
            entry as Parameters<typeof renderLoadedSessionEntry>[1],
        );
    }
}

/** 从新旧两种持久化格式构建统一会话条目。 */
export function buildEntriesFromSession(newSessionId: () => string, session: AgentSession): SessionEntry[] {
    const entriesLen = session.entries?.length || 0;
    // 旧 messages 数据比 entries 更完整时优先迁移旧数据。
    if (session.messages && session.messages.length > entriesLen) {
        const entries: SessionEntry[] = [];
        for (const msg of session.messages) {
            if (msg.role === "user") {
                entries.push({id: newSessionId(), type: "user", content: msg.content});
                continue;
            }
            if (msg.role !== "assistant") {
                continue;
            }
            const toolCalls: AgentToolCall[] = (msg.toolCalls || []).map((toolCall) => ({
                name: toolCall.name,
                arguments: toolCall.arguments || {},
                ...(toolCall.id ? {id: toolCall.id} : {}),
                ...(toolCall.result !== undefined ? {result: toolCall.result} : {}),
            }));
            entries.push({id: newSessionId(), type: "assistant", content: msg.content,
                ...(toolCalls.length > 0 ? {toolCalls} : {})});
        }
        return entries;
    }
    if (session.entries && session.entries.length > 0) {
        return buildAgentPresentationEntries(session.entries)
            .map((entry) => deserializeSessionEntry(
                entry as Parameters<typeof deserializeSessionEntry>[0],
            ))
            .filter((entry): entry is SessionEntry => entry !== null);
    }
    return [];
}
