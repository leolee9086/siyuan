/** 用途：约束问题卡片运行时；使用范围：终态结算；解耦评估：运行时接口经目录网关隔离具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：持久化问题终态；使用范围：命中当前问题条目后；解耦评估：统一保存入口隔离会话仓储协议。 */
import {saveSession} from "./imports";
/** 用途：读取终态标签；使用范围：只读卡片结算；解耦评估：状态文案由交互领域集中维护。 */
import {resolveInteractionStatusLabel} from "./imports";
/** 用途：约束问题终态；使用范围：公开结算命令。 */
import type {AgentQuestionResolution} from "./AgentChat.question.types";

/** 按 questionID 结算问题条目和 DOM；答案与状态均来自明确协议字段。 @同步豁免: 需要绝对同步的DOM访问 - 必须一次性关闭全部问题输入。 */
export function resolveQuestion(runtime: AgentChatRuntime, resolution: AgentQuestionResolution) {
    const entry = runtime.entries.find((candidate) =>
        candidate.type === "question" && candidate.questionID === resolution.questionID);
    // 只有 resolved 事件携带权威答案时才覆盖条目，提交请求阶段仍保持 pending 状态。
    if (entry?.type === "question" && resolution.answers) {
        entry.answers = [...resolution.answers];
    }
    // 命中当前内存条目时同时应用终态和可选答案，再异步保存同一会话快照。
    if (entry?.type === "question") {
        entry.status = resolution.status;
        void saveSession(runtime).catch((error) => console.error("save agent question state failed:", error));
    }
    const element = Array.from(runtime.messagesContainer.querySelectorAll<HTMLElement>("[data-question-id]"))
        .find((candidate) => candidate.getAttribute("data-question-id") === resolution.questionID);
    if (!element) {
        return;
    }
    element.classList.add("agent-chat__msg--confirmed");
    for (const field of element.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")) {
        field.disabled = true;
    }
    const actions = element.querySelector(".agent-chat__question-submit");
    // 当前卡片仍有提交区时，以服务端终态标签替换全部可点击动作。
    if (actions) {
        actions.innerHTML = '<span class="agent-chat__confirm-done">' +
            resolveInteractionStatusLabel("question", resolution.status) + "</span>";
    }
}
