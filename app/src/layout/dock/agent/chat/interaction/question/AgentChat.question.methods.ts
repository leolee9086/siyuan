import type {AgentChatRuntime} from "./imports";
import {renderQuestionCardHTML} from "./imports";
import {bindQuestionOptionToggles, bindQuestionSubmit} from "./AgentChat.question.helpers";
import {isQuestionList} from "./AgentChat.question.guard";
import {finishActiveThinking} from "./imports";
import {flushThinkingStep} from "./imports";
import {insertBeforeAI} from "./imports";
import {scrollToBottom} from "./imports";

/** 追加问题卡片并绑定选项提交。 @同步豁免: UI构建 - SSE 事件处理必须按到达顺序立即建立问题卡片。 */
export function appendQuestion(runtime: AgentChatRuntime, questionID: string, args: Record<string, unknown>,
                               roundID?: string) {
    finishActiveThinking(runtime);
    flushThinkingStep(runtime);
    const rawQuestions = args.questions;
    if (!isQuestionList(rawQuestions) || rawQuestions.length === 0) {
        return;
    }

    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--question";
    element.setAttribute("data-question-id", questionID);
    element.innerHTML = renderQuestionCardHTML(rawQuestions, questionID);
    const sessionID = runtime.sessionId;
    const questionEntryID = runtime.sessionPorts.repository.newSessionId();
    element.setAttribute("data-message-id", questionEntryID);
    runtime.entries.push({
        id: questionEntryID,
        type: "question",
        questionID,
        questions: rawQuestions,
        status: "pending",
        ...(roundID || runtime.currentRoundID ? {roundID: roundID || runtime.currentRoundID} : {}),
    });
    bindQuestionOptionToggles(element);
    bindQuestionSubmit(runtime, {
        el: element,
        questionID,
        questionCount: rawQuestions.length,
        sessionID,
        questionEntryID,
    });

    insertBeforeAI(runtime, element);
    scrollToBottom(runtime, true);
    runtime.hasInterveningCard = true;
}
