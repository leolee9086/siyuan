/**
 * MAGI贤者响应处理与投票流程
 */

// [TASK] T2.2 迁移composables和工具函数 - magiConsensus

import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { WrappedSeel } from "./useMagi.types";
import { createMessage } from "../utils/messageFactory";
import { processStreamResponse } from "../utils/streamProcessor";
import { isSageResponse } from "./magiConsensus.guard";
import { getMagiI18nText } from "../utils/magiI18n";
import { 获取真实投票决策 } from "./consensus/realVote";
import type { 审议上下文 } from "./consensus/realVote.types";

const MELCHIOR_META_PATTERN =
    /\[MELCHIOR_META\]\s*requires_deliberation\s*[:=]\s*(?<flag>true|false)\s*\[\/MELCHIOR_META\]/i;
const PLAIN_DELIBERATION_PATTERN = /requires_deliberation\s*[:=]\s*(?<flag>true|false)/i;

/** 将包装实例的消息列表同步回原始AI实例 */
async function syncOriginalMessages(seel: WrappedSeel): Promise<void> {
    if (seel._originalAI) {
        seel._originalAI.messages.length = 0;
    }
}

/** 向贤者消息列表追加用户消息 */
async function appendUserMessage(seel: WrappedSeel, content: string): Promise<void> {
    const msg = await createMessage("user", content);
    seel.messages.push(msg);
}

/** 按ID更新或插入消息（流式chunk更新时使用） */
async function upsertMessage(seel: WrappedSeel, msg: MagiMessage): Promise<void> {
    const existing = seel.messages.find((m) => m.id === msg.id);
    if (existing) {
        Object.assign(existing, msg);
        return;
    }
    seel.messages.push({ ...msg });
}

/** 根据贤者名称映射投票字段 */
function resolveVoteFieldBySeelName(seelName: string): "melchior" | "balthazar" | "casper" | null {
    if (seelName.includes("MELCHIOR")) {
        return "melchior";
    }
    if (seelName.includes("BALTHASAR")) {
        return "balthazar";
    }
    if (seelName.includes("CASPER")) {
        return "casper";
    }
    return null;
}

/** 流开始时：标记加载并写入用户消息 */
function onStreamStart(seel: WrappedSeel, userMessage: string): void {
    seel.loading = true;
    void appendUserMessage(seel, userMessage);
}

/** 每个 chunk 到达时：更新同 ID 消息内容 */
function onStreamChunk(seel: WrappedSeel, msg: MagiMessage): void {
    void upsertMessage(seel, msg);
}

/** 流结束时：清理加载态 */
function onStreamComplete(seel: WrappedSeel): void {
    seel.loading = false;
}

/** 流异常时：写入错误消息并清理加载态 */
async function onStreamError(seel: WrappedSeel, error: Error): Promise<void> {
    seel.loading = false;
    const errMsg = await createMessage("error", error.message);
    seel.messages.push(errMsg);
}

/** @同步豁免: 性能考虑 - 仅创建闭包回调对象，无异步工作。 */
export function buildStreamCallbacks(seel: WrappedSeel, userMessage: string) {
    const onStart = onStreamStart.bind(null, seel, userMessage);
    const onChunk = onStreamChunk.bind(null, seel);
    const onComplete = onStreamComplete.bind(null, seel);
    const onError = onStreamError.bind(null, seel);
    return {
        onStart,
        onChunk,
        onComplete,
        onError,
    };
}

/** 收集所有贤者对用户消息的响应 */
export async function processSagesResponses(
    sages: WrappedSeel[],
    userMessage: string,
    trinityHistory: string,
): Promise<SageResponse[]> {
    const responsePromises = sages.map((seel) => collectSingleSageResponse(seel, userMessage, trinityHistory));
    const results = await Promise.all(responsePromises);
    return results.filter(isSageResponse);
}

/** 收集单个贤者的响应 */
export async function collectSingleSageResponse(
    seel: WrappedSeel,
    userMessage: string,
    trinityHistory: string,
): Promise<SageResponse | null> {
    try {
        await syncOriginalMessages(seel);
        const isMelchior = seel.config.name.includes("MELCHIOR");
        const response = await seel.reply(userMessage, {
            context: {
                trinityHistory,
            },
        });
        const callbacks = buildStreamCallbacks(seel, userMessage);
        const { content, success, hasToolCalls } = await processStreamResponse(
            response,
            callbacks,
            isMelchior ? { captureToolCalls: true } : {},
        );
        if (!success) {
            return null;
        }
        // 仅 Melchior 响应需要解析审慎决策元标记，其它贤者直接返回正文。
        if (isMelchior) {
            const parsed = parseMelchiorResponse(content);
            return {
                content: parsed.content,
                seel: seel.config.name,
                displayName: seel.config.displayName,
                requiresDeliberation: parsed.requiresDeliberation,
                usedToolCall: hasToolCalls === true,
            };
        }
        return { content, seel: seel.config.name, displayName: seel.config.displayName };
    } catch {
        seel.loading = false;
        return null;
    }
}

/** 解析 Melchior 的审慎决策标注，并清理输出中的元标记 */
function parseMelchiorResponse(content: string): { content: string; requiresDeliberation: boolean } {
    const metaMatch = content.match(MELCHIOR_META_PATTERN);
    if (metaMatch) {
        return {
            content: sanitizeMelchiorResponse(content),
            requiresDeliberation: metaMatch.groups?.flag?.toLowerCase() === "true",
        };
    }
    const plainMatch = content.match(PLAIN_DELIBERATION_PATTERN);
    return {
        content: sanitizeMelchiorResponse(content),
        requiresDeliberation: plainMatch?.groups?.flag?.toLowerCase() === "true",
    };
}

/** 按贤者名称获取对应响应内容 */
function findSageContent(
    validResponses: SageResponse[],
    seelName: string,
    fallback: string,
): string {
    return validResponses.find((response) => response.seel.includes(seelName))?.content ?? fallback;
}

/** 清理 Melchior 输出中的元标记，避免渲染到聊天界面 */
function sanitizeMelchiorResponse(content: string): string {
    return content
        .replace(MELCHIOR_META_PATTERN, "")
        .replace(/^\s*requires_deliberation\s*[:=]\s*(true|false)\s*$/gim, "")
        .trim();
}

/** @同步豁免: 性能考虑 - 纯字符串拼接，无I/O或状态竞争。 */
export function buildTrinityIntrospectionInput(
    validResponses: SageResponse[],
): string {
    const melchior = findSageContent(validResponses, "MELCHIOR", "我还在整理逻辑线索。");
    const balthazar = findSageContent(validResponses, "BALTHASAR", "我还在感受这件事的情绪波动。");
    const casper = findSageContent(validResponses, "CASPER", "我暂时没有明确的本能倾向。");

    return `逻辑告诉我：${melchior}

情绪告诉我：${balthazar}

直觉告诉我：${casper}`;
}

/** 处理Trinity对所有贤者响应的统合 */
export async function handleTrinitySummary(
    validResponses: SageResponse[],
    trinity: WrappedSeel,
    userInput: string,
): Promise<string | null> {
    if (validResponses.length === 0) {
        return null;
    }
    try {
        const introspection = buildTrinityIntrospectionInput(validResponses);
        const safeUserInput = userInput.trim() || "请继续当前任务。";
        const trinityContext = { context: { userInput: safeUserInput, responses: validResponses, introspection } };
        const trinityResponse = await trinity.reply("", trinityContext);
        const callbacks = buildStreamCallbacks(trinity, "[trinity-internal-stitch]");
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

/** 判断当前请求是否需要进入审慎决策模式（Critical Decision） */
export async function 需要审慎决策(
    validResponses: SageResponse[],
): Promise<boolean> {
    const melchior = validResponses.find((response) => response.seel.includes("MELCHIOR"));
    return melchior?.requiresDeliberation === true;
}

/** 计算三票是否通过（>= 2/3） */
function computePassed(vote: VoteResult): boolean {
    const approved = [vote.melchior, vote.balthazar, vote.casper].filter((item) => item === "批准").length;
    return approved >= 2;
}

/** 执行贤者二元表决流程 */
export async function processVoting(
    sages: WrappedSeel[],
    proposedAction: string,
    voteContext: 审议上下文,
    updateProgress: (progress: number) => void,
): Promise<VoteResult | null> {
    const reviewers = sages.filter((sage) => !sage.config.name.includes("MELCHIOR"));
    // 审慎投票只允许其余两个侧面复核，若两侧缺失则本轮无法完成投票。
    if (reviewers.length === 0) {
        updateProgress(100);
        return null;
    }

    const ballots: Partial<Record<"melchior" | "balthazar" | "casper", "批准" | "否决">> = {};
    let completed = 0;
    for (const sage of reviewers) {
        updateProgress(Math.floor((completed / reviewers.length) * 100));
        const result = await collectSingleVote(sage, proposedAction, voteContext);
        const voteField = resolveVoteFieldBySeelName(sage.config.name);
        // 只有当前侧面的单票结果存在且可映射到固定字段时，才写入最终票箱。
        if (result && voteField) {
            ballots[voteField] = result[voteField];
        }
        completed += 1;
    }

    updateProgress(100);
    if (!ballots.balthazar && !ballots.casper) {
        return null;
    }

    const merged: VoteResult = {
        melchior: "批准",
        balthazar: ballots.balthazar ?? "否决",
        casper: ballots.casper ?? "否决",
        passed: false,
        round: 1,
    };
    merged.passed = computePassed(merged);
    return merged;
}

/** 收集单个贤者的投票结果 */
async function collectSingleVote(
    seel: WrappedSeel,
    proposedAction: string,
    voteContext: 审议上下文,
): Promise<VoteResult | null> {
    try {
        const decision = await 获取真实投票决策(seel, proposedAction, voteContext);
        const voteField = resolveVoteFieldBySeelName(seel.config.name);
        const voteResult: VoteResult = {
            melchior: "否决",
            balthazar: "否决",
            casper: "否决",
            passed: false,
            round: 1,
        };
        // 非 Melchior 的侧面名称与字段可一一映射，映射成功后回填该侧面的真实决策。
        if (voteField) {
            voteResult[voteField] = decision;
        }
        const voteMsg = await createMessage("vote", `${getMagiI18nText("evaluationCompleted")}: ${decision}`, {
            decision,
            round: voteResult.round,
        });
        voteMsg.status = "success";
        seel.messages.push(voteMsg);
        return voteResult;
    } catch {
        const errMsg = await createMessage("error", getMagiI18nText("evaluationFailed"));
        errMsg.status = "error";
        seel.messages.push(errMsg);
        return null;
    }
}
