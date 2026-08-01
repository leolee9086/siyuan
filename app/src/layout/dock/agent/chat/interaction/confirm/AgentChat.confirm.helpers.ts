/** 用途：约束确认按钮失败反馈所需的聊天能力；使用范围：提交回调。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：转义确认卡片动态文本；使用范围：DOM 字符串构建。 */
import {escapeHtml} from "./imports";
/** 用途：约束确认卡片展示输入；使用范围：DOM 创建。 */
import type {ConfirmCardInput} from "./AgentChat.confirm.types";
/** 用途：约束确认请求回调；使用范围：按钮提交。 */
import type {ConfirmRequest} from "./AgentChat.confirm.types";

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
    submission: ConfirmRequest & {el: HTMLElement; doneText: string},
    submit: (request: ConfirmRequest) => Promise<boolean>,
) {
    const buttons = Array.from(submission.el.querySelectorAll<HTMLButtonElement>("button"));
    for (const button of buttons) {
        button.disabled = true;
    }
    const accepted = await submit(submission);
    if (!accepted) {
        for (const button of buttons) {
            button.disabled = false;
        }
        runtime.capabilities.showMessage?.(window.siyuan.languages._kernel[28], 3000);
        return;
    }
    submission.el.classList.add("agent-chat__msg--confirmed");
    const actions = submission.el.querySelector(".agent-chat__confirm-actions");
    if (actions) {
        actions.innerHTML = '<span class="agent-chat__confirm-done">' + submission.doneText + "</span>";
    }
}

/** 绑定一个存在的确认按钮。 */
function bindConfirmButton(
    runtime: AgentChatRuntime,
    binding: ConfirmRequest & {el: HTMLElement; doneText: string; selector: string},
    submit: (request: ConfirmRequest) => Promise<boolean>,
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
    submit: (request: ConfirmRequest) => Promise<boolean>,
) {
    const languages = window.siyuan.languages;
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-approve", approved: true,
        always: false, doneText: languages.agentConfirmApprove || "Approved"}, submit);
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-reject", approved: false,
        always: false, doneText: languages.agentConfirmReject || "Rejected"}, submit);
    bindConfirmButton(runtime, {...input, selector: ".agent-chat__confirm-always", approved: true,
        always: true, doneText: languages.agentConfirmAlways || "Session Allow"}, submit);
}
