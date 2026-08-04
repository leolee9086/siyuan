/** 用途：约束 AgentChat 状态；使用范围：queue dock；解耦评估：运行时协议经本目录网关隔离门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束 controller 状态；使用范围：能力和快照渲染；解耦评估：队列视图只消费统一协议。 */
import type {AgentConversationState} from "./imports";
/** 用途：约束 queue item；使用范围：单项模板；解耦评估：不复制 Kernel 快照结构。 */
import type {AgentConversationQueueItem} from "./imports";
/** 用途：读取界面语言；使用范围：按钮和 tooltip；解耦评估：复用既有环境入口。 */
import {getAgentChatLanguages} from "./imports";
/** 用途：转义消息和属性；使用范围：queue HTML 模板；解耦评估：复用项目统一转义函数。 */
import {escapeHtml} from "./imports";

/** 从可扩展语言对象读取本功能文案。 */
function readQueueLanguage(key: string, fallback: string) {
    const value = Reflect.get(getAgentChatLanguages(), key);
    return typeof value === "string" ? value : fallback;
}

/** 终态 queue 项保留在内核审计快照中，但不占用活动 dock。 */
function isVisibleQueueItem(item: AgentConversationQueueItem) {
    return item.optimistic || (item.state !== "cancelled" && item.state !== "injected" && item.state !== "completed");
}

/** 按状态为 queue 项选择用户可观察标签。 */
function queueStateLabel(state: string) {
    const labels: Record<string, {languageKey: string; fallback: string}> = {
        pending: {languageKey: "agentQueuePending", fallback: "Pending"},
        injecting: {languageKey: "agentQueueInjecting", fallback: "Sending"},
        blocked: {languageKey: "agentQueueBlocked", fallback: "Blocked"},
        failed: {languageKey: "agentQueueFailed", fallback: "Failed"},
    };
    const descriptor = labels[state];
    return descriptor ? readQueueLanguage(descriptor.languageKey, descriptor.fallback) : state;
}

/** 为 queue 项构建一个只包含图标的命令按钮，调用时由能力和状态决定禁用态。 */
function renderQueueAction(options: {name: string; label: string; icon: string; disabled?: boolean}) {
    return "<button type=\"button\" class=\"agent-chat__queue-action b3-button b3-button--icon " +
        "b3-tooltips b3-tooltips__n\" data-queue-action=\"" + options.name + "\" aria-label=\"" +
        escapeHtml(options.label) + "\"" + (options.disabled ? " disabled" : "") + ">" +
        "<svg><use xlink:href=\"#" + options.icon + "\"></use></svg></button>";
}

/** 构建单个 queue 项及其能力驱动动作。 */
function renderQueueItem(runtime: AgentChatRuntime, item: AgentConversationQueueItem, state: AgentConversationState) {
    const editLabel = getAgentChatLanguages().edit;
    const cancelLabel = getAgentChatLanguages().cancel;
    const steerLabel = readQueueLanguage("agentSteer", "Steer");
    const pending = item.state === "pending" || item.optimistic;
    const editing = runtime.editingQueueInputID === item.input.id;
    const queued = item.input.semantics === "queue";
    const promoteDisabled = !pending || !state.steerable || !state.turnID;
    return '<div class="agent-chat__queue-item' + (editing ? " agent-chat__queue-item--editing" : "") + '" ' +
        'data-input-id="' + escapeHtml(item.input.id) + '" data-state="' + escapeHtml(item.state) + '">' +
        '<span class="agent-chat__queue-state" title="' + escapeHtml(queueStateLabel(item.state)) + '"></span>' +
        '<span class="agent-chat__queue-content">' + escapeHtml(item.input.content || "") + "</span>" +
        '<span class="agent-chat__queue-actions">' +
        (queued && state.adapter.capabilities.supportsQueueEdit ? renderQueueAction({
            name: "edit", label: editLabel, icon: "iconEdit", disabled: !pending,
        }) : "") +
        (queued && state.adapter.capabilities.supportsSteer ? renderQueueAction({
            name: "promote", label: steerLabel, icon: "iconForward", disabled: promoteDisabled,
        }) : "") +
        (queued ? renderQueueAction({
            name: "cancel", label: cancelLabel, icon: "iconClose", disabled: !pending,
        }) : "") +
        "</span></div>";
}

/** 执行 queue 命令并在版本冲突或网络失败后恢复权威快照。 */
async function runQueueCommand(runtime: AgentChatRuntime, command: () => Promise<unknown>) {
    try {
        await command();
    } catch (error) {
        await runtime.conversationController?.refresh();
        const message = error instanceof Error ? error.message : String(error);
        runtime.capabilities.showMessage?.(message, 4000);
    }
}

/** 将 pending queue 内容带回 Composer，下一次发送执行版本化 update。 */
function beginQueueEdit(runtime: AgentChatRuntime, item: AgentConversationQueueItem) {
    runtime.editingQueueInputID = item.input.id;
    runtime.composer?.setText(item.input.content || "");
    runtime.composer?.focus();
    const state = runtime.conversationController?.state;
    if (state) {
        renderAgentConversationControls(runtime, state);
    }
}

/** 根据事件委托动作执行编辑、提升或取消。 */
function handleQueueAction(runtime: AgentChatRuntime, event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }
    const controller = runtime.conversationController;
    if (!controller) {
        return;
    }
    const button = target.closest<HTMLButtonElement>("[data-queue-action]");
    const itemElement = target.closest<HTMLElement>("[data-input-id]");
    const inputID = itemElement?.dataset.inputId || "";
    const item = controller.state.queueItems.find((candidate) => candidate.input.id === inputID);
    if (!button || !item || button.disabled) {
        return;
    }
    event.stopPropagation();
    const action = button.dataset.queueAction;
    // 编辑命令只把权威 pending 内容带回 Composer，实际更新由下一次发送统一提交。
    if (action === "edit") {
        beginQueueEdit(runtime, item);
        return;
    }
    const state = controller.state;
    // 提升必须携带当前活动 turn 和最新 queueVersion，由内核原子判定竞争结果。
    if (action === "promote" && state.turnID) {
        void runQueueCommand(runtime, () => controller.promoteQueue({
            inputID, queueVersion: state.queueVersion, expectedTurnID: state.turnID,
            requestHeaders: runtime.sessionPorts.requestHeaders,
        }));
        return;
    }
    // 取消同样只作用于 pending 项，失败时由 runQueueCommand 恢复权威快照。
    if (action === "cancel") {
        void runQueueCommand(runtime, () => controller.cancelQueue({
            inputID, queueVersion: state.queueVersion, requestHeaders: runtime.sessionPorts.requestHeaders,
        }));
    }
}

/**
 * 绑定投递模式和 queue dock 的实例级事件委托。
 * @同步豁免: UI构建 - DOM 监听器必须在面板初始化周期内登记，且只绑定当前实例元素。
 */
export function bindAgentConversationControls(runtime: AgentChatRuntime) {
    runtime.steerDeliveryBtn.addEventListener("click", () => runtime.conversationController?.setDelivery("steer"));
    runtime.queueDeliveryBtn.addEventListener("click", () => runtime.conversationController?.setDelivery("queue"));
    runtime.queueDock.addEventListener("click", (event: MouseEvent) => handleQueueAction(runtime, event));
}

/**
 * 将 adapter 能力、活动 turn 和权威 queue 快照投影到共享控件。
 * @同步豁免: UI构建 - 一个 queueVersion 的模式与列表必须在同一 DOM 更新周期内呈现。
 */
export function renderAgentConversationControls(runtime: AgentChatRuntime, state: AgentConversationState) {
    const capabilities = state.adapter.capabilities;
    const active = Boolean(state.turnID) && state.phase !== "idle";
    const showDelivery = active && (capabilities.supportsSteer || capabilities.supportsQueue);
    runtime.deliveryControl.classList.toggle("fn__none", !showDelivery);
    runtime.steerDeliveryBtn.disabled = !capabilities.supportsSteer || !state.steerable || !state.turnID;
    runtime.queueDeliveryBtn.disabled = !capabilities.supportsQueue;
    const selectedSteer = state.selectedDelivery === "steer" && !runtime.steerDeliveryBtn.disabled;
    runtime.steerDeliveryBtn.classList.toggle("agent-chat__delivery-option--active", selectedSteer);
    runtime.queueDeliveryBtn.classList.toggle("agent-chat__delivery-option--active", !selectedSteer);
    runtime.steerDeliveryBtn.setAttribute("aria-pressed", selectedSteer ? "true" : "false");
    runtime.queueDeliveryBtn.setAttribute("aria-pressed", selectedSteer ? "false" : "true");
    const items = state.queueItems.filter(isVisibleQueueItem);
    // 编辑目标被权威快照移除时结束编辑身份，但保留 Composer 文本供用户决定是否重新提交。
    if (runtime.editingQueueInputID && !items.some((item) => item.input.id === runtime.editingQueueInputID)) {
        runtime.editingQueueInputID = "";
    }
    runtime.queueDock.classList.toggle("fn__none", items.length === 0);
    runtime.queueDock.innerHTML = items.map((item) => renderQueueItem(runtime, item, state)).join("");
}

/**
 * 清除未被执行 adapter 接管目标上的全部控制器投影。
 * @同步豁免: UI构建 - 目标切换必须在同一渲染周期隐藏旧队列和投递控件，异步清理会短暂暴露前一目标状态。
 */
export function clearAgentConversationControls(runtime: AgentChatRuntime) {
    runtime.editingQueueInputID = "";
    runtime.deliveryControl?.classList.add("fn__none");
    runtime.queueDock?.classList.add("fn__none");
    if (runtime.queueDock) {
        runtime.queueDock.innerHTML = "";
    }
}
