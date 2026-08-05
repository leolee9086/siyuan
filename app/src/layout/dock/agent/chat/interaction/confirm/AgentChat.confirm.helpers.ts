/** 用途：约束确认按钮失败反馈所需的聊天能力；使用范围：提交回调。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：转义确认卡片动态文本；使用范围：DOM 字符串构建；解耦评估：纯转义边界无需通过参数逐层传递。 */
import {escapeHtml} from "./imports";
/** 用途：约束确认卡片展示输入；使用范围：DOM 创建。 */
import type {ConfirmCardInput} from "./AgentChat.confirm.types";
/** 用途：约束确认请求回调；使用范围：按钮提交。 */
import type {ConfirmRequest} from "./AgentChat.confirm.types";
/** 用途：约束确认提交结算；使用范围：按钮请求状态机。 */
import type {AgentInteractionRequestResult} from "./imports";

/** 创建确认卡片 DOM。 @同步豁免: UI构建 */
export function createConfirmCard(input: ConfirmCardInput) {
    const languages = window.siyuan.languages;
    const element = document.createElement("div");
    const argsText = JSON.stringify(input.args, null, 2);
    const description = (languages.agentConfirmDesc || "Agent: {category} operation")
        .replace("{category}", escapeHtml(input.category));
    const sessionAllowButton = renderSessionAllowButton(input.name);
    element.className = "agent-chat__msg agent-chat__msg--confirm";
    element.innerHTML = '<div class="agent-chat__confirm-card">' +
        '<div class="agent-chat__confirm-header"><svg class="agent-chat__confirm-icon"><use xlink:href="#iconInfo"></use></svg> ' +
        description + "</div>" + input.effectsHTML +
        '<pre class="agent-chat__confirm-args">' + escapeHtml(argsText) + "</pre>" +
        '<div class="agent-chat__confirm-actions">' +
        '<button class="b3-button b3-button--cancel agent-chat__confirm-reject">' +
        (languages.agentConfirmReject || "Reject") + "</button>" +
        '<button class="b3-button b3-button--text agent-chat__confirm-approve">' +
        (languages.agentConfirmApprove || "Approve") + "</button>" + sessionAllowButton + "</div></div>";
    return element;
}

/** 为无需会话级授权的运行时操作隐藏会话允许按钮。 */
function renderSessionAllowButton(name: string) {
    if (name === "forge_runtime_restart" || name === "forge_runtime_approve_tests") {
        return "";
    }
    const languages = window.siyuan.languages;
    return '<button class="b3-button b3-button--text agent-chat__confirm-always ariaLabel" data-position="n" aria-label="' +
        (languages.agentConfirmAlwaysDesc || "Session Allow") + '">' +
        (languages.agentConfirmAlways || "Session Allow") + "</button>";
}

/** 提交确认并让按钮状态严格跟随请求结果。 */
async function submitConfirm(
    runtime: AgentChatRuntime,
    submission: ConfirmRequest & {el: HTMLElement},
    submit: (request: ConfirmRequest) => Promise<AgentInteractionRequestResult>,
) {
    const buttons = Array.from(submission.el.querySelectorAll<HTMLButtonElement>("button"));
    for (const button of buttons) {
        button.disabled = true;
    }
    const result = await submit(submission);
    // 仅传输异常没有服务端终态，此时恢复原卡片操作以便用户重试同一请求。
    if (result.state === "retryable") {
        for (const button of buttons) {
            button.disabled = false;
        }
        runtime.capabilities.showMessage?.(result.message, 3000);
        return;
    }
    // accepted 等待 confirm_resolved 事件；resolved 已由请求层按服务端结构化状态结算。
}

/** 绑定一个存在的确认按钮。 */
function bindConfirmButton(
    runtime: AgentChatRuntime,
    binding: ConfirmRequest & {el: HTMLElement; selector: string},
    submit: (request: ConfirmRequest) => Promise<AgentInteractionRequestResult>,
) {
    const button = binding.el.querySelector(binding.selector);
    if (!button) {
        return;
    }
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        void submitConfirm(runtime, binding, submit);
    });
}

/** 注册确认卡片按钮监听器。 @同步豁免: 生命周期 */
export function bindConfirmCardActions(
    runtime: AgentChatRuntime,
    input: {el: HTMLElement; confirmID: string; sessionID: string; confirmEntryID: string},
    submit: (request: ConfirmRequest) => Promise<AgentInteractionRequestResult>,
) {
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-approve", approved: true,
        always: false}, submit);
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-reject", approved: false,
        always: false}, submit);
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-always", approved: true,
        always: true}, submit);
}
