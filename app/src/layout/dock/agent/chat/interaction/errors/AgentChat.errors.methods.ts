/** 用途：生成后端重试状态卡片 HTML；使用范围：重试卡片渲染；解耦评估：纯字符串渲染，集中转出避免重复导入。 */
import {renderRetryCardHTML} from "./imports";
/** 用途：约束运行时契约；使用范围：本文件全部函数；解耦评估：类型仅编译期存在，无运行时耦合。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：立即写入思考卡或助手消息的待处理令牌正文；使用范围：停止生成收尾；解耦评估：令牌状态刷新集中在本模块，经公开入口调用。 */
import {flushTokenUpdate} from "./imports";
/** 用途：轮询并提交被中断轮次的权威恢复记录；使用范围：停止生成后的恢复流程；解耦评估：恢复流程集中在本模块，经公开入口调用。 */
import {recoverInterruptedTurn} from "./imports";
/** 用途：从磁盘权威会话重绘当前视图；使用范围：停止生成后的状态同步；解耦评估：重载属于会话职责，集中调用避免重复实现。 */
import {reloadFromDisk} from "./imports";
/** 用途：把当前思考步骤写入会话条目；使用范围：停止生成收尾；解耦评估：步骤提交集中在本模块，经公开入口调用。 */
import {flushThinkingStep} from "./imports";
/** 用途：收尾流式响应（物化助手条目、完成流式 DOM、重置流式状态）；使用范围：停止生成收尾；解耦评估：响应生命周期集中在本模块，经公开入口调用。 */
import {appendCurrentAssistantEntry} from "./imports";
import {finalizeResponseElement} from "./imports";
import {resetStreamingResponseState} from "./imports";
/** 用途：根据用户消息重建导航标记；使用范围：会话重载后；解耦评估：导航渲染集中在本模块，经公开入口调用。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：维持消息贴底；使用范围：重试卡片插入后；解耦评估：滚动行为集中在本模块，经公开入口调用。 */
import {scrollToBottom} from "./imports";
/** 用途：切换流式交互锁并同步控件状态；使用范围：停止生成后；解耦评估：交互锁状态集中在本模块，经公开入口调用。 */
import {setStreaming} from "./imports";
/** 用途：移除流式思考卡片并完成当前思考；使用范围：停止生成与重试收尾；解耦评估：思考卡片状态集中在本模块，经公开入口调用。 */
import {clearThinking} from "./imports";
import {finishActiveThinking} from "./imports";
/** 用途：刷新令牌圆环展示；使用范围：停止生成后；解耦评估：令牌展示是本目录职责，同层直接复用。 */
import {updateTokenDisplay} from "./imports";
/** 用途：在当前助手占位之前插入交互卡片；使用范围：重试卡片插入；解耦评估：消息插入集中在本模块，经公开入口调用。 */
import {insertBeforeAI} from "./imports";

/** 追加后端重试状态卡片。 @同步豁免: UI构建 */
export function appendRetry(runtime: AgentChatRuntime, attempt: number, maxRetries: number) {
    finishActiveThinking(runtime);
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingStepContent = "";
    runtime.renderedToolNames = {};
    clearThinking(runtime);
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--retry";
    element.innerHTML = renderRetryCardHTML(attempt, maxRetries);
    insertBeforeAI(runtime, element);
    scrollToBottom(runtime, true);
    runtime.hasInterveningCard = true;
}

/** 停止前端流并等待后端中断检查点恢复。 */
export async function stopGeneration(runtime: AgentChatRuntime) {
    runtime.abortController?.abort();
    runtime.abortController = null;
    flushTokenUpdate(runtime);
    finishActiveThinking(runtime);
    const savedContent = runtime.currentContent;
    const timestamp = Date.now();
    finalizeResponseElement(runtime, {
        content: savedContent,
        fullContent: runtime.fullContent,
        timestamp,
    });
    flushThinkingStep(runtime);
    appendCurrentAssistantEntry(runtime, timestamp, false);
    resetStreamingResponseState(runtime);
    updateTokenDisplay(runtime);
    setStreaming(runtime, false);
    const sessionID = runtime.sessionId;
    const turnID = runtime.currentTurnID;
    try {
        await reloadFromDisk(runtime, true);
    } catch (error) {
        console.error("reload agent session after stop failed:", error);
    }
    // reloadFromDisk 为异步操作，等待期间用户可能切换到其他会话；仅当仍停留在被停止的会话时才触发恢复，避免恢复轮询作用于错误会话。
    if (runtime.sessionId === sessionID) {
        void recoverInterruptedTurn(runtime, sessionID, turnID);
    }
    rebuildNavMarkers(runtime);
}
