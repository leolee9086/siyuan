/** 用途：约束问题卡片运行时；使用范围：选项与提交绑定；解耦评估：运行时接口经目录网关隔离具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：提交问题答案；使用范围：问题卡片按钮回调；解耦评估：同目录请求职责保持为唯一提交入口。 */
import {postQuestionAnswer} from "./AgentChat.question.submit";
/** 用途：约束提交三态结果；使用范围：按钮恢复逻辑；解耦评估：共享请求判别联合避免用异常文本推断状态。 */
import type {AgentInteractionRequestResult} from "./imports";

/** 绑定问题选项切换。 @同步豁免: 生命周期 - 事件监听器必须在卡片插入时一次性注册。 */
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
 * 同步读取当前问题卡片中的答案。
 * @同步豁免: 需要绝对同步的DOM访问 - 提交请求必须使用同一次点击时刻的字段快照。
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

/** 绑定问题提交按钮。 @同步豁免: 生命周期 - 监听器必须随卡片创建同步注册且只注册一次。 */
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
    const result: AgentInteractionRequestResult = await postQuestionAnswer(runtime, {...input, answers});
    // 只有传输异常保留重试入口；业务失败已经按结构化终态关闭卡片。
    if (result.state === "retryable") {
        submitButton.disabled = false;
        for (const field of inputs) {
            field.disabled = false;
        }
        runtime.capabilities.showMessage?.(result.message, 3000);
        return;
    }
    // accepted 等待 question_resolved 事件；resolved 已由请求层结算。
}
