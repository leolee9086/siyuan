/** 用途：约束流式响应状态；使用范围：同一 turn 的 assistant 分段。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：完成活动思考卡；使用范围：steer 注入边界；解耦评估：复用响应领域既有生命周期命令，避免复制思考状态。 */
import {finishActiveThinking} from "./imports";
/** 用途：提交当前思考步骤；使用范围：steer 注入边界；解耦评估：步骤持久化由既有唯一入口维护。 */
import {flushThinkingStep} from "./imports";
/** 用途：刷新令牌展示；使用范围：assistant 分段完成；解耦评估：指标 DOM 由既有投影函数所有。 */
import {updateTokenDisplay} from "./imports";
/** 用途：重建消息导航；使用范围：assistant 分段完成；解耦评估：导航索引由既有唯一入口维护。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：提交当前 assistant 条目；使用范围：同一 turn 分段；解耦评估：条目结构由响应 helper 统一生成。 */
import {appendCurrentAssistantEntry} from "./AgentChat.response.helpers";
/** 用途：完成当前 assistant DOM；使用范围：同一 turn 分段；解耦评估：流式 DOM 规则由响应 helper 统一维护。 */
import {finalizeResponseElement} from "./AgentChat.response.helpers";
/** 用途：提交已结算确认条目；使用范围：同一 turn 分段；解耦评估：确认条目顺序由响应 helper 统一维护。 */
import {flushPendingConfirmEntries} from "./AgentChat.response.helpers";
/** 用途：清空当前 assistant 临时状态；使用范围：为下一段输出建立独立容器；解耦评估：流状态重置由响应 helper 统一维护。 */
import {resetStreamingResponseState} from "./AgentChat.response.helpers";

/**
 * 在 steer user entry 插入前结算当前 assistant 段，但不提交 turn，也不释放 Composer。
 * @同步豁免: 生命周期 - assistant/user 的事件顺序必须在同一 eventSeq 处理栈内完成。
 */
export function finishAssistantSegment(runtime: AgentChatRuntime) {
    const thinkingCard = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)",
    );
    finishActiveThinking(runtime);
    const timestamp = Date.now();
    finalizeResponseElement(runtime, {
        content: runtime.currentContent,
        fullContent: runtime.fullContent,
        timestamp,
        thinkingCard,
    });
    flushThinkingStep(runtime);
    flushPendingConfirmEntries(runtime);
    appendCurrentAssistantEntry(runtime, timestamp, true);
    resetStreamingResponseState(runtime);
    runtime.requestStartTime = Date.now();
    updateTokenDisplay(runtime);
    rebuildNavMarkers(runtime);
}
