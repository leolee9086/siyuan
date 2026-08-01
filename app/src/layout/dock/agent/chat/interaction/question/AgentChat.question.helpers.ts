import type {AgentChatRuntime} from "./imports";
import {postQuestionAnswer} from "./AgentChat.question.submit";

/** `bindQuestionOptionToggles` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export function bindQuestionOptionToggles(el: HTMLElement) {
    for (const option of el.querySelectorAll(".agent-chat__question-option")) {
        const input = option.querySelector<HTMLInputElement>("input");
        if (!input) {
            return;
        }
        let wasChecked = false;
        option.addEventListener("mousedown", () => {
            wasChecked = input.checked;
        });
        option.addEventListener("click", (event) => {
            // 条件 !el.classList.contains("agent-chat__msg--confirmed") &&... 成立时才执行此分支，避免影响其它会话或响应阶段。
            if (!el.classList.contains("agent-chat__msg--confirmed") && input.type === "radio" && wasChecked) {
                event.preventDefault();
                input.checked = false;
            }
        });
    }
}

/**
 * `collectQuestionAnswers` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export function collectQuestionAnswers(el: HTMLElement, questionCount: number): string[] {
    const answers: string[] = [];
    for (let questionIndex = 0; questionIndex < questionCount; questionIndex++) {
        const options = el.querySelector('.agent-chat__question-options[data-qi="' + questionIndex + '"]');
        for (const input of options?.querySelectorAll<HTMLInputElement>("input:checked") || []) {
            answers.push(input.value);
        }
        const customInput = el.querySelector<HTMLInputElement>(
            '.agent-chat__question-custom[data-qi="' + questionIndex + '"]'
        );
        // 条件 customInput?.value.trim() 成立时才执行此分支，避免影响其它会话或响应阶段。
        if (customInput?.value.trim()) {
            answers.push(customInput.value.trim());
        }
    }
    return answers;
}

/** `bindQuestionSubmit` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
export function bindQuestionSubmit(runtime: AgentChatRuntime, input: {
    el: HTMLElement;
    questionID: string;
    questionCount: number;
    sessionID: string;
    questionEntryID: string;
}) {
    const submitButton = input.el.querySelector<HTMLButtonElement>(".agent-chat__question-submit-btn");
    submitButton?.addEventListener("click", () => void submitQuestion(runtime, input, submitButton));
}

/** 提交当前问题卡片，在请求期间锁定输入，并把结果投影回原卡片。 */
async function submitQuestion(
    runtime: AgentChatRuntime,
    input: {
        el: HTMLElement;
        questionID: string;
        questionCount: number;
        sessionID: string;
        questionEntryID: string;
    },
    submitButton: HTMLButtonElement,
) {
    const answers = collectQuestionAnswers(input.el, input.questionCount);
    const inputs = Array.from(input.el.querySelectorAll<HTMLInputElement>("input"));
    submitButton.disabled = true;
    for (const field of inputs) {
        field.disabled = true;
    }
    const accepted = await postQuestionAnswer(runtime, {...input, answers});
    // 请求失败时恢复原卡片的全部输入，并由宿主显示统一错误消息。
    if (!accepted) {
        submitButton.disabled = false;
        for (const field of inputs) {
            field.disabled = false;
        }
        runtime.capabilities.showMessage?.(window.siyuan.languages._kernel[28], 3000);
        return;
    }
    input.el.classList.add("agent-chat__msg--confirmed");
    const actions = input.el.querySelector(".agent-chat__question-submit");
    // 提交区仍属于当前卡片时，用只读完成状态替换交互按钮。
    if (actions) {
        actions.innerHTML = '<span class="agent-chat__confirm-done">' +
            (window.siyuan.languages.agentQuestionSubmitted || "Submitted") + "</span>";
    }
}
