/** 用途：生成快照回滚条目标识；使用范围：回滚成功持久化；解耦评估：状态条目构造属于持久化领域，保留集中仓储。 */
/** 用途：转义快照提示中的标识文本；使用范围：快照信息 DOM 构建；解耦评估：纯函数工具，保持直接引用。 */
import {escapeHtml} from "./imports";
/** 用途：请求内核执行快照回滚；使用范围：回滚确认后；解耦评估：网络请求属于内核边界，保留直接引用。 */
import {fetchPost} from "./imports";
/** 用途：约束快照流程读写的聊天状态；使用范围：本文件所有函数；解耦评估：运行时契约由组合根注入，类型导入无运行时耦合。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：持久化回滚后会话；使用范围：回滚成功持久化；解耦评估：会话持久化复用既有仓储，避免重复实现。 */
import {saveSession} from "./imports";
/** 用途：在 AI 回复前插入快照提示；使用范围：无锚点时的兜底插入；解耦评估：DOM 放置策略封装于消息放置端口，保持引用。 */
import {insertBeforeAI} from "./imports";
/** 用途：快照信息变化后维持贴底；使用范围：快照与回滚插入；解耦评估：滚动反馈封装于滚动端口，保持引用。 */
import {scrollToBottom} from "./imports";

/** 创建快照或回滚信息元素。 */
function createSnapshotInfoElement(runtime: AgentChatRuntime, input: {
    snapshotID: string;
    entryID?: string;
    completed: boolean;
}) {
    const languages = window.siyuan.languages;
    const shortID = input.snapshotID.length > 7 ? input.snapshotID.substring(0, 7) : input.snapshotID;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--snapshot";
    if (input.entryID) {
        element.setAttribute("data-message-id", input.entryID);
    }
    const label = input.completed
        ? languages.rollbackCompleted || "Rollback completed"
        : languages.snapshotAutoCreated || "Auto snapshot created";
    element.innerHTML = '<div class="agent-chat__snapshot-body">' +
        '<span class="agent-chat__snapshot-icon"><svg><use xlink:href="#iconHistory"></use></svg></span>' +
        '<span class="agent-chat__snapshot-text">' + escapeHtml(label + " " + shortID) + "</span>" +
        (input.completed ? "" : '<button class="b3-button b3-button--text agent-chat__snapshot-rollback ariaLabel" aria-label="' +
            (languages.rollback || "Rollback") + '"><svg><use xlink:href="#iconUndo"></use></svg></button>') +
        "</div>";
    return {element, shortID};
}

/** 把快照提示插入当前执行区域之前。 */
function insertSnapshotInfo(runtime: AgentChatRuntime, element: HTMLElement) {
    const confirmCards = runtime.messagesContainer.querySelectorAll(".agent-chat__msg--confirm");
    const confirmCard = confirmCards.item(confirmCards.length - 1);
    const activeThinking = runtime.messagesContainer.querySelector(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done)",
    );
    const anchor = confirmCard || activeThinking;
    if (anchor) {
        runtime.messagesContainer.insertBefore(element, anchor);
        return;
    }
    insertBeforeAI(runtime, element);
}

/** 回滚成功后追加已回滚条目并渲染只读提示，随后持久化会话。 */
function handleRollbackDone(runtime: AgentChatRuntime, snapshotID: string) {
    const entryID = runtime.sessionPorts.repository.newSessionId();
    runtime.entries.push({id: entryID, type: "rollback", snapshotID});
    appendRollbackInfo(runtime, snapshotID, entryID);
    void saveSession(runtime);
}

/** 组装回滚确认文案并调用宿主确认端口，仅确认后发起回滚请求。 */
function handleRollbackClick(runtime: AgentChatRuntime, input: {
    snapshotID: string;
    shortID: string;
}) {
    const languages = window.siyuan.languages;
    const text = (languages.rollbackConfirm || "Rollback cannot be undone")
        .replace("${name}", languages.dataSnapshot || "Snapshot")
        .replace("${time}", input.shortID);
    runtime.capabilities.confirm?.(languages.rollback || "Rollback", text, () => {
        fetchPost("/api/repo/checkoutRepo", {id: input.snapshotID, sessionID: runtime.sessionId}, () => {
            handleRollbackDone(runtime, input.snapshotID);
        });
    });
}

/** 绑定快照回滚确认与持久化流程。 */
function bindSnapshotRollback(runtime: AgentChatRuntime, input: {
    element: HTMLElement;
    snapshotID: string;
    shortID: string;
}) {
    const button = input.element.querySelector<HTMLButtonElement>(".agent-chat__snapshot-rollback");
    if (!button) {
        return;
    }
    button.addEventListener("click", () => {
        handleRollbackClick(runtime, input);
    });
}

/** 追加可执行回滚的自动快照提示。 @同步豁免: UI构建 */
export function appendSnapshotInfo(runtime: AgentChatRuntime, snapshotID: string, entryID?: string) {
    const result = createSnapshotInfoElement(runtime, {
        snapshotID,
        ...(entryID !== undefined ? {entryID} : {}),
        completed: false,
    });
    bindSnapshotRollback(runtime, {element: result.element, snapshotID, shortID: result.shortID});
    insertSnapshotInfo(runtime, result.element);
    scrollToBottom(runtime, true);
    runtime.hasInterveningCard = true;
}

/** 追加已完成回滚的只读提示。 @同步豁免: UI构建 */
export function appendRollbackInfo(runtime: AgentChatRuntime, snapshotID: string, entryID?: string) {
    const {element} = createSnapshotInfoElement(runtime, {
        snapshotID,
        ...(entryID !== undefined ? {entryID} : {}),
        completed: true,
    });
    runtime.messagesContainer.appendChild(element);
    scrollToBottom(runtime, true);
}
