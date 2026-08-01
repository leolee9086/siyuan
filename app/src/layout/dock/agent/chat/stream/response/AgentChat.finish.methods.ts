/** 用途：约束响应生命周期共享状态；使用范围：响应完成和标题生成；解耦评估：纯类型经响应子领域网关提供。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：读取已初始化语言配置；使用范围：标题生成请求；解耦评估：经响应子领域网关依赖环境读取入口。 */
import {requireSiyuanConfig} from "./imports";
/** 用途：提交当前会话；使用范围：响应完成和标题更新；解耦评估：经响应子领域网关调用会话持久化流程。 */
import {saveSession} from "./imports";
/** 用途：完成活动思考卡；使用范围：响应 DOM 收尾前；解耦评估：经响应子领域网关复用思考状态生命周期。 */
import {finishActiveThinking} from "./imports";
/** 用途：读取当前模型；使用范围：标题生成请求；解耦评估：经响应子领域网关复用模型选择状态。 */
import {getSelectedModel} from "./imports";
/** 用途：刷新令牌展示；使用范围：响应状态重置后；解耦评估：经响应子领域网关复用指标投影。 */
import {updateTokenDisplay} from "./imports";
/** 用途：提交当前助手条目；使用范围：响应保存前；解耦评估：同一响应子领域内直接复用轮次收尾操作。 */
import {appendCurrentAssistantEntry} from "./AgentChat.response.helpers";
/** 用途：完成流式助手 DOM；使用范围：响应保存前；解耦评估：同一响应子领域内直接复用 DOM 收尾操作。 */
import {finalizeResponseElement} from "./AgentChat.response.helpers";
/** 用途：提交待处理确认条目；使用范围：响应保存前；解耦评估：同一响应子领域内直接复用轮次收尾操作。 */
import {flushPendingConfirmEntries} from "./AgentChat.response.helpers";
/** 用途：发送完成通知；使用范围：响应全部协调完成后；解耦评估：同一响应子领域内直接调用宿主通知决策。 */
import {notifyFinishedResponse} from "./AgentChat.response.helpers";
/** 用途：协调后端权威会话；使用范围：响应保存后；解耦评估：同一响应子领域内集中处理重绘和滚动恢复。 */
import {reconcileCanonicalSession} from "./AgentChat.response.helpers";
/** 用途：清空本轮流式状态；使用范围：响应条目形成后；解耦评估：同一响应子领域内集中维护轮次状态边界。 */
import {resetStreamingResponseState} from "./AgentChat.response.helpers";
/** 用途：提交当前思考步骤；使用范围：响应保存前；解耦评估：经响应子领域网关复用思考条目生命周期。 */
import {flushThinkingStep} from "./imports";
/** 用途：释放流式交互锁；使用范围：权威会话协调后；解耦评估：经响应子领域网关复用统一交互状态入口。 */
import {setStreaming} from "./imports";
/** 用途：重建消息导航标记；使用范围：响应全部协调后；解耦评估：经响应子领域网关复用导航投影。 */
import {rebuildNavMarkers} from "./imports";

/** 完成流式响应、提交会话并同步权威快照。 */
export async function finishResponse(runtime: AgentChatRuntime, notify = true) {
    const activeThinkingCard = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)",
    );
    finishActiveThinking(runtime);
    const savedContent = runtime.currentContent;
    const savedFullContent = runtime.fullContent;
    const timestamp = Date.now();
    finalizeResponseElement(runtime, {
        content: savedContent,
        fullContent: savedFullContent,
        timestamp,
        thinkingCard: activeThinkingCard,
    });
    flushThinkingStep(runtime);
    flushPendingConfirmEntries(runtime);
    appendCurrentAssistantEntry(runtime, timestamp, true);
    resetStreamingResponseState(runtime);
    updateTokenDisplay(runtime);
    const sessionID = runtime.sessionId;
    const canonicalSession = await saveSession(runtime, runtime.currentTurnID);
    runtime.pendingEditDraft = null;
    await reconcileCanonicalSession(runtime, canonicalSession, sessionID);
    setStreaming(runtime, false);
    // 标题可能在响应保存期间异步返回；只把仍属于当前会话的待提交标题写入权威快照。
    if (runtime.pendingSessionTitle !== null && runtime.sessionId === sessionID) {
        await saveSession(runtime);
    }
    rebuildNavMarkers(runtime);
    notifyFinishedResponse(runtime, notify, savedContent);
}

/** 将有效标题应用到仍处于同一请求会话的运行时，并在空闲时立即持久化。 */
function applyGeneratedTitle(
    runtime: AgentChatRuntime,
    requestSessionID: string,
    data: {code?: number; data?: string},
) {
    // 标题响应必须成功、非空、发生变化且仍属于发起请求的会话，才能修改当前界面状态。
    if (runtime.sessionId !== requestSessionID || data.code !== 0 || !data.data || data.data === runtime.sessionTitle) {
        return;
    }
    runtime.sessionTitle = data.data;
    runtime.pendingSessionTitle = data.data;
    runtime.titleElement.textContent = data.data;
    // 当前没有进行中的轮次时直接保存标题；流式期间由 finishResponse 的最终保存统一提交。
    if (!runtime.isStreaming && !runtime.currentTurnID) {
        void saveSession(runtime);
    }
}

/** 请求会话标题，并在响应仍属于当前会话时应用。 */
export async function tryGenerateTitle(runtime: AgentChatRuntime) {
    // 每个会话只启动一次自动标题请求，避免并发响应互相覆盖。
    if (runtime.hasTitled) {
        return;
    }
    runtime.hasTitled = true;
    const requestSessionID = runtime.sessionId;
    const userEntry = runtime.entries.find((entry) => entry.type === "user");
    const userMessage = userEntry?.content?.slice(0, 500) || "";
    // MAGI 会话标题由其自身会话源管理，不调用原生 Agent 标题接口。
    if (runtime.conversationKind === "magi") {
        return;
    }
    try {
        const response = await fetch("/api/ai/agent/title", {
            method: "POST",
            headers: runtime.sessionPorts.requestHeaders({
                headers: {"Content-Type": "application/json"},
            }),
            body: JSON.stringify({
                sessionID: runtime.sessionId,
                message: userMessage,
                model: getSelectedModel(runtime),
                language: requireSiyuanConfig().appearance.lang,
            }),
        });
        const data: {code?: number; data?: string} = await response.json();
        applyGeneratedTitle(runtime, requestSessionID, data);
    } catch (error) {
        console.error("agent title request error:", error);
    }
}
