/** 用途：创建结构化编辑提交事件；使用范围：编辑确认按钮；解耦评估：事件工厂隔离事件名与 payload 结构，调用方只负责派发。 */
import {createAgentChatUserEditSubmitEvent} from "./AgentChat.userEditEvent.factory";
/** 用途：格式化用户消息时间；使用范围：动作区元信息；解耦评估：经消息子领域网关复用纯格式化能力，无宿主依赖。 */
import {formatMessageTime} from "./imports";
/** 用途：校验用户正文点击目标；使用范围：正文点击编辑入口；解耦评估：经消息子领域网关复用通用 DOM 类型守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：收窄当前会话条目；使用范围：开始编辑前；解耦评估：守卫属于同一用户消息领域，直接依赖可保持判别逻辑唯一。 */
import {isUserEntry} from "./AgentChat.user.guard";
/** 用途：约束编辑状态；使用范围：本文件全部函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束恢复的用户条目；使用范围：编辑取消。 */
import type {UserEntry} from "./imports";
/** 用途：约束只读消息动作共享状态；使用范围：复制和编辑事件；解耦评估：完整上下文避免为每个回调创建相近接口。 */
import type {UserMessageActionContext} from "./imports";
/** 用途：约束编辑控件共享状态；使用范围：取消、提交和键盘事件；解耦评估：完整上下文避免隐式闭包状态。 */
import type {UserEditBindingContext} from "./imports";
/** 用途：读取编辑所需 DOM；使用范围：编辑控件构建；解耦评估：经消息子领域网关复用统一的模板失配处理。 */
import {requireElement} from "./imports";
/** 用途：重建用户消息正文；使用范围：编辑取消；解耦评估：与用户消息渲染同属一个生命周期，直接调用避免重复模板。 */
import {createUserMessageBody} from "./AgentChat.userRender";
/** 用途：恢复只读富文本；使用范围：编辑取消；解耦评估：与用户消息渲染同属一个生命周期，直接调用保持后处理一致。 */
import {renderUserMessage} from "./AgentChat.userRender";

/** 建立编辑文本框和确认、取消按钮。 */
function createUserEditControls(element: HTMLElement, content: string) {
    const body = requireElement<HTMLElement>(element, ".agent-chat__body");
    const actions = requireElement<HTMLElement>(element, ".agent-chat__msg-actions");
    const textarea = document.createElement("textarea");
    textarea.className = "b3-text-field agent-chat__edit-textarea";
    textarea.value = content;
    body.replaceChildren(textarea);
    const cancel = document.createElement("button");
    cancel.className = "b3-button b3-button--cancel";
    cancel.textContent = window.siyuan.languages.cancel;
    const submit = document.createElement("button");
    submit.className = "b3-button b3-button--text";
    submit.textContent = window.siyuan.languages.confirm;
    actions.replaceChildren(cancel, submit);
    return {textarea, cancel, submit};
}

/** 把编辑中的元素恢复成可再次操作的只读用户消息。 */
function restoreEditedUserMessage(runtime: AgentChatRuntime, element: HTMLElement, entry: UserEntry) {
    runtime.editingUserEntryID = "";
    // 当前暂存草稿属于正在恢复的条目时一并清除，避免会话重载再次进入编辑态。
    if (runtime.pendingEditDraft?.entryID === entry.id) {
        runtime.pendingEditDraft = null;
    }
    element.classList.remove("agent-chat__msg--editing");
    element.replaceChildren(createUserMessageBody(runtime, entry.content, entry.blockHTML));
    const body = requireElement<HTMLElement>(element, ".agent-chat__body");
    bindUserMessageActions(runtime, {
        element,
        body,
        text: entry.content,
        ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {}),
        ...(entry.id !== undefined ? {entryID: entry.id} : {}),
    });
    renderUserMessage(runtime, element);
}

/** 绑定用户消息编辑的恢复、提交和键盘操作。 */
function bindUserEditControls(runtime: AgentChatRuntime, context: UserEditBindingContext) {
    context.controls.cancel.addEventListener(
        "click",
        restoreEditedUserMessage.bind(undefined, runtime, context.element, context.entry),
    );
    context.controls.submit.addEventListener("click", submitUserEdit.bind(undefined, runtime, context));
    context.controls.textarea.addEventListener("keydown", handleUserEditKeyDown.bind(undefined, runtime, context));
}

/** 校验编辑正文并发出结构化提交事件。 */
function submitUserEdit(runtime: AgentChatRuntime, context: UserEditBindingContext) {
    const content = context.controls.textarea.value.trim();
    // 空白正文不产生编辑提交，焦点保留在输入框供用户修正。
    if (!content) {
        context.controls.textarea.focus();
        return;
    }
    runtime.messagesContainer.dispatchEvent(createAgentChatUserEditSubmitEvent({entryID: context.entryID, content}));
}

/** 把 Escape 和 Ctrl/Cmd+Enter 映射到编辑取消与统一提交路径。 */
function handleUserEditKeyDown(runtime: AgentChatRuntime, context: UserEditBindingContext, event: KeyboardEvent) {
    // 输入法组合期间不解释 Enter 或 Escape，避免截断正在输入的文字。
    if (event.isComposing) {
        return;
    }
    // Escape 明确取消本次编辑并恢复原条目。
    if (event.key === "Escape") {
        event.preventDefault();
        restoreEditedUserMessage(runtime, context.element, context.entry);
        return;
    }
    // Ctrl/Cmd+Enter 复用确认按钮，保证鼠标和键盘进入同一提交路径。
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        context.controls.submit.click();
    }
}

/** 创建用户消息动作区 HTML。 */
function createUserMessageActionsHTML(timestamp?: number) {
    const time = timestamp
        ? '<span class="agent-chat__msg-meta agent-chat__msg-time">' + formatMessageTime(timestamp) + "</span>"
        : "";
    return '<div class="agent-chat__msg-actions">' + time +
        '<span class="block__icon block__icon--show ariaLabel agent-chat__user-copy" data-position="north" aria-label="' +
        window.siyuan.languages.copy + '"><svg><use xlink:href="#iconCopy"></use></svg></span>' +
        '<span class="block__icon block__icon--show ariaLabel agent-chat__user-edit" data-position="north" aria-label="' +
        window.siyuan.languages.edit + '"><svg><use xlink:href="#iconEdit"></use></svg></span></div>';
}

/**
 * 绑定复制、编辑按钮和正文点击编辑入口。
 * @同步豁免: UI构建
 */
export function bindUserMessageActions(runtime: AgentChatRuntime, input: UserMessageActionContext) {
    const {element, body, timestamp} = input;
    element.insertAdjacentHTML("beforeend", createUserMessageActionsHTML(timestamp));
    const copyButton = element.querySelector(".agent-chat__user-copy");
    copyButton?.addEventListener("click", copyUserMessage.bind(undefined, runtime, input));
    const editButton = element.querySelector(".agent-chat__user-edit");
    editButton?.addEventListener("click", editUserMessageFromButton.bind(undefined, runtime, input));
    body.addEventListener("click", editUserMessageFromBody.bind(undefined, runtime, input));
}

/** 复制用户正文并在写入剪贴板后通知当前宿主。 */
async function copyUserMessage(runtime: AgentChatRuntime, context: UserMessageActionContext, event: Event) {
    event.stopPropagation();
    await navigator.clipboard.writeText(context.text);
    runtime.capabilities.showMessage?.(window.siyuan.languages.copied, 2000);
}

/** 按选择、流式和镜像锁状态决定是否进入用户消息编辑。 */
function editUserMessage(runtime: AgentChatRuntime, context: UserMessageActionContext, force: boolean) {
    const selection = window.getSelection();
    const selectingText = selection && !selection.isCollapsed && context.element.contains(selection.anchorNode);
    // 缺少条目标识、状态被锁或用户正在选择文字时保持只读视图。
    if (!context.entryID || runtime.isStreaming || runtime.mirrorLocked || (!force && selectingText)) {
        return;
    }
    beginEditUserMessage(runtime, {entryID: context.entryID, element: context.element});
}

/** 从显式编辑按钮强制进入编辑，不受文本选择状态影响。 */
function editUserMessageFromButton(runtime: AgentChatRuntime, context: UserMessageActionContext, event: Event) {
    event.stopPropagation();
    editUserMessage(runtime, context, true);
}

/** 仅在正文非交互区域点击时进入编辑。 */
function editUserMessageFromBody(runtime: AgentChatRuntime, context: UserMessageActionContext, event: Event) {
    const target = event.target;
    if (!isHTMLElement(target)) {
        return;
    }
    const interactive = target.closest('[data-type~="a"], [data-type~="block-ref"], ' +
        '[data-type~="file-annotation-ref"], [data-type~="tag"], [data-subtype], a[href], img');
    if (!interactive) {
        editUserMessage(runtime, context, false);
    }
}

/**
 * 开始编辑指定用户消息，并在当前事件结束前完成可见控件替换和焦点定位。
 * @同步豁免: UI构建
 */
export function beginEditUserMessage(
    runtime: AgentChatRuntime,
    input: Readonly<{entryID: string; element: HTMLElement; initialContent?: string}>,
) {
    const {entryID, element, initialContent} = input;
    // 已有编辑、响应流或镜像锁任一生效时不建立第二个编辑器。
    if (runtime.editingUserEntryID || runtime.isStreaming || runtime.mirrorLocked) {
        return;
    }
    const candidate = runtime.entries.find((item) => item.id === entryID);
    if (!candidate || !isUserEntry(candidate)) {
        return;
    }
    runtime.editingUserEntryID = entryID;
    element.classList.add("agent-chat__msg--editing");
    const controls = createUserEditControls(element, initialContent ?? candidate.content);
    bindUserEditControls(runtime, {entryID, entry: candidate, element, controls});
    controls.textarea.focus();
    controls.textarea.setSelectionRange(controls.textarea.value.length, controls.textarea.value.length);
}

/**
 * 在权威会话重载后恢复尚未提交的用户编辑草稿。
 * 当前 DOM 必须在重载生命周期内立即重新进入编辑态，避免草稿与可见消息不一致。
 * @同步豁免: 生命周期
 */
export function restorePendingEditDraft(runtime: AgentChatRuntime) {
    const draft = runtime.pendingEditDraft;
    if (!draft) {
        return;
    }
    const userElement = runtime.messagesContainer.querySelector<HTMLElement>(
        '.agent-chat__msg--user[data-message-id="' + draft.entryID + '"]');
    if (userElement) {
        beginEditUserMessage(runtime, {
            entryID: draft.entryID,
            element: userElement,
            initialContent: draft.content,
        });
    }
}
