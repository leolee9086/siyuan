import type { SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { WrappedSeel } from "./useMagi.types";
import { createMessage } from "../utils/messageFactory";
import { processStreamResponse } from "../utils/streamProcessor";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    buildStreamCallbacks,
    buildTrinityIntrospectionInput,
    collectSingleSageResponse,
} from "./magiConsensus";

const MELCHIOR_ACTION_PROPOSAL_REQUEST = `你已发起审慎决策流程。请仅用一句话简要说明建议行动的目的与内容。
要求：
1. 明确“要做什么”（例如：需要编写代码/需要阻止用户行动）。
2. 明确“为什么要做”。
3. 不要输出多段分析，不要输出元标记。`;
const MELCHIOR_ACTION_EXECUTION_REQUEST = `你已获得本轮临时主导行动权。
请基于已通过提案立即执行行动，并输出：
1. 一句“执行说明”（正在做什么）。
2. 一段“执行结果”（本轮给用户的可见结果）。`;

/** 让 Melchior 在发起审慎决策后补充一句行动提案 */
export async function 生成梅基奥尔行动提案(
    sages: WrappedSeel[],
    validResponses: SageResponse[],
    userMessage: string,
): Promise<string> {
    const melchior = sages.find((seel) => seel.config.name.includes("MELCHIOR"));
    if (!melchior) {
        return userMessage;
    }

    const melchiorBase =
        validResponses.find((response) => response.seel.includes("MELCHIOR"))?.content
        ?? "请根据当前上下文给出提案。";
    const followUpPrompt = `${MELCHIOR_ACTION_PROPOSAL_REQUEST}

用户原始输入：
${userMessage}

你当前的关键判断：
${melchiorBase}`;
    const followUpResponse = await collectSingleSageResponse(melchior, followUpPrompt);
    const proposal = followUpResponse?.content?.trim();
    if (!proposal) {
        return userMessage;
    }
    return proposal;
}

/** Melchior 临时主导执行动作 */
export async function 执行梅基奥尔主导行动(
    sages: WrappedSeel[],
    userMessage: string,
    proposedAction: string,
): Promise<string | null> {
    const melchior = sages.find((seel) => seel.config.name.includes("MELCHIOR"));
    if (!melchior) {
        return null;
    }

    const executePrompt = `${MELCHIOR_ACTION_EXECUTION_REQUEST}

用户原始输入：
${userMessage}

已通过提案：
${proposedAction}`;
    const executionResponse = await collectSingleSageResponse(melchior, executePrompt);
    return executionResponse?.content?.trim() || null;
}

/** 构造“审慎决策通过后”供 Trinity 使用的复杂思考输入 */
function buildPostActionIntrospection(
    validResponses: SageResponse[],
    proposedAction: string,
    vote: VoteResult,
    melchiorActionResult: string,
): string {
    const initialIntrospection = buildTrinityIntrospectionInput(validResponses);
    return `${initialIntrospection}

本轮审慎决策提案：
${proposedAction}

复核投票结果：
- BALTHASAR: ${vote.balthazar}
- CASPER: ${vote.casper}
- 结论: ${vote.passed ? "通过" : "未通过"}

Melchior 临时主导执行结果：
${melchiorActionResult}`;
}

/** 审慎决策通过后由 Trinity 输出最终表达 */
export async function handleTrinityPostActionSummary(
    validResponses: SageResponse[],
    trinity: WrappedSeel,
    proposedAction: string,
    vote: VoteResult,
    melchiorActionResult: string,
): Promise<string | null> {
    if (validResponses.length === 0) {
        return null;
    }
    try {
        const introspection = buildPostActionIntrospection(
            validResponses,
            proposedAction,
            vote,
            melchiorActionResult,
        );
        const trinityContext = { context: { responses: validResponses, introspection } };
        const trinityResponse = await trinity.reply("", trinityContext);
        const callbacks = buildStreamCallbacks(trinity, "[trinity-post-action-stitch]");
        const { content, success } = await processStreamResponse(
            trinityResponse,
            callbacks,
            { mode: "trinity-speak-tool" },
        );
        return success ? content : null;
    } catch {
        trinity.loading = false;
        const errMsg = await createMessage("error", getMagiI18nText("responseGenerationFailed"));
        trinity.messages.push(errMsg);
        return null;
    }
}
