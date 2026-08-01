/** 用途：约束助手动作状态；使用范围：本文件全部函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：检查历史工具副作用；使用范围：编辑和重新生成资格；解耦评估：经动作子领域网关依赖条目分析能力，不读取持久化实现。 */
import {hasAgentExecutedToolsAfter} from "./imports";
/** 用途：计算目标能力；使用范围：重新生成按钮可见性；解耦评估：经动作子领域网关读取统一目标策略，避免在视图重复目标判断。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：格式化助手时间；使用范围：动作栏元信息；解耦评估：经动作子领域网关复用纯格式化能力，无宿主依赖。 */
import {formatMessageTime} from "./imports";
/** 用途：约束动作栏选项；使用范围：助手消息渲染。 */
import type {AssistantMessageActionOptions} from "./AgentChat.assistantActions.types";
/** 用途：提交重新生成意图；使用范围：动作按钮点击；解耦评估：结构化事件隔离动作视图与流式重新生成实现。 */
import {dispatchAgentChatRegenerateRequest} from "./AgentChat.regenerateEvent";

/** 查找目标助手消息之前最近的用户条目标识。 @同步豁免: 需要绝对同步的DOM访问 */
export function findUserEntryIDBeforeElement(element: HTMLElement) {
    let current: Element | null = element;
    while (current) {
        if (current.classList.contains("agent-chat__msg--user")) {
            return current instanceof HTMLElement ? current.dataset.messageId : undefined;
        }
        current = current.previousElementSibling;
    }
    return undefined;
}

/** 为助手消息追加复制和可选重新生成入口。 @同步豁免: UI构建 */
export function addCopyButton(
    runtime: AgentChatRuntime,
    element: HTMLElement,
    options: AssistantMessageActionOptions = {},
) {
    const body = element.querySelector<HTMLElement>(".agent-chat__body");
    const content = options.contentOverride || runtime.fullContent || body?.textContent || "";
    const actions = document.createElement("div");
    actions.className = "agent-chat__msg-actions";
    appendMessageTime(actions, options.timestamp);
    actions.appendChild(createCopyButton(runtime, content));
    // 调用方允许且当前目标具备重新生成能力时才展示入口。
    if (options.allowRegenerate !== false && resolveTargetPolicy(runtime).regenerationVisible) {
        actions.appendChild(createRegenerateButton(runtime, element));
    }
    element.appendChild(actions);
}

/** 创建可选助手消息时间。 */
function appendMessageTime(actions: HTMLElement, timestamp?: number) {
    if (!timestamp) {
        return;
    }
    const time = document.createElement("span");
    time.className = "agent-chat__msg-meta agent-chat__msg-time--ai";
    time.textContent = formatMessageTime(timestamp);
    actions.appendChild(time);
}

/** 创建复制正文按钮。 */
function createCopyButton(runtime: AgentChatRuntime, content: string) {
    const button = createActionButton(window.siyuan.languages.copy, "#iconCopy");
    button.addEventListener("click", copyAssistantContent.bind(undefined, runtime, content));
    return button;
}

/** 阻止消息卡点击冒泡，复制助手正文并在完成后通知用户。 */
async function copyAssistantContent(runtime: AgentChatRuntime, content: string, event: Event) {
    event.stopPropagation();
    await navigator.clipboard.writeText(content);
    runtime.capabilities.showMessage?.(window.siyuan.languages.copied, 2000);
}

/** 创建重新生成意图按钮。 */
function createRegenerateButton(runtime: AgentChatRuntime, element: HTMLElement) {
    const button = createActionButton(window.siyuan.languages.agentRegenerate, "#iconRefresh");
    button.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        dispatchAgentChatRegenerateRequest(runtime, findUserEntryIDBeforeElement(element));
    });
    return button;
}

/** 创建统一图标动作元素。 */
function createActionButton(label: string, icon: string) {
    const button = document.createElement("span");
    button.className = "block__icon block__icon--show ariaLabel";
    button.setAttribute("data-position", "north");
    button.setAttribute("aria-label", label);
    button.innerHTML = `<svg><use xlink:href="${icon}"></use></svg>`;
    return button;
}

/** 判断指定历史位置之后是否仍允许重新生成。 @同步豁免: 生命周期 */
export function canRegenerateHistoryFrom(runtime: AgentChatRuntime, entryIndex: number) {
    if (runtime.pendingConfirms.length === 0 && !hasAgentExecutedToolsAfter(runtime.entries, entryIndex)) {
        return true;
    }
    runtime.capabilities.showMessage?.(
        window.siyuan.languages.agentEditHistoryWarning ||
        "This history contains executed tools and cannot be replayed.",
        4000,
    );
    return false;
}
