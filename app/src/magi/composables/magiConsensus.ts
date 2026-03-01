/**
 * MAGI贤者响应处理与共识生成
 */

// [TASK] T2.2 迁移composables和工具函数 - magiConsensus

import type { ConsensusMessage, MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { WrappedSeel } from "./useMagi.types";
import { createMessage } from "../utils/messageFactory";
import { processStreamResponse } from "../utils/streamProcessor";
import { isSageResponse } from "./magiConsensus.guard";
import { getMagiI18nText } from "../utils/magiI18n";

const DELIBERATION_TRIGGER_KEYWORDS = ["重要", "风险", "危险", "不可逆", "决策", "投资", "合同", "医疗", "法律", "critical", "risk"];

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

/** 构建流式处理回调集合 */
function buildStreamCallbacks(seel: WrappedSeel, userMessage: string) {
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
): Promise<SageResponse[]> {
    const responsePromises = sages.map((seel) => collectSingleSageResponse(seel, userMessage));
    const results = await Promise.all(responsePromises);
    return results.filter(isSageResponse);
}

/** 收集单个贤者的响应 */
async function collectSingleSageResponse(
    seel: WrappedSeel,
    userMessage: string,
): Promise<SageResponse | null> {
    try {
        await syncOriginalMessages(seel);
        const response = await seel.reply(userMessage);
        const callbacks = buildStreamCallbacks(seel, userMessage);
        const { content, success } = await processStreamResponse(response, callbacks);
        if (!success) {
            return null;
        }
        return { content, seel: seel.config.name, displayName: seel.config.displayName };
    } catch {
        seel.loading = false;
        return null;
    }
}

/** 处理Trinity对所有贤者响应的统合 */
export async function handleTrinitySummary(
    validResponses: SageResponse[],
    trinity: WrappedSeel,
    userMessage: string,
): Promise<string | null> {
    if (validResponses.length === 0) {
        return null;
    }
    try {
        const introspectionInput = buildTrinityIntrospectionInput(validResponses, userMessage);
        const trinityContext = { context: { responses: validResponses } };
        const trinityResponse = await trinity.reply(introspectionInput, trinityContext);
        const callbacks = buildStreamCallbacks(trinity, "[内省输入] 三贤者输出已汇总");
        const { content, success } = await processStreamResponse(trinityResponse, callbacks);
        return success ? content : null;
    } catch {
        trinity.loading = false;
        const errMsg = await createMessage("error", getMagiI18nText("responseGenerationFailed"));
        trinity.messages.push(errMsg);
        return null;
    }
}

/** 将三贤者输出组织为 Trinity 内省输入（非用户直达输入） */
function buildTrinityIntrospectionInput(
    validResponses: SageResponse[],
    userMessage: string,
): string {
    const findContent = (name: string, fallback: string): string =>
        validResponses.find((response) => response.seel.includes(name))?.content ?? fallback;

    const melchior = findContent("MELCHIOR", "我还在整理逻辑线索。");
    const balthazar = findContent("BALTHASAR", "我还在感受这件事的情绪波动。");
    const casper = findContent("CASPER", "我暂时没有明确的本能倾向。");

    return `[外界输入]
哥哥说：${userMessage}

[理性面]
基于逻辑与事实，我认为：${melchior}

[感性面]
基于情感与直觉，我认为：${balthazar}

[本能面]
本能告诉我：${casper}`;
}

/** 判断当前请求是否需要进入审慎决策模式（Critical Decision） */
export async function 需要审慎决策(
    userMessage: string,
    validResponses: SageResponse[],
): Promise<boolean> {
    const text = `${userMessage}\n${validResponses.map((r) => r.content).join("\n")}`.toLowerCase();
    return DELIBERATION_TRIGGER_KEYWORDS.some((keyword) => text.includes(keyword));
}

/** 计算三票是否通过（>= 2/3） */
function computePassed(vote: VoteResult): boolean {
    return [vote.melchior, vote.balthazar, vote.casper].filter((decision) => decision === "批准").length >= 2;
}

/** 执行贤者二元表决流程 */
export async function processVoting(
    sages: WrappedSeel[],
    proposedAction: string,
    updateProgress: (progress: number) => void,
): Promise<VoteResult | null> {
    const ballots: Partial<Record<"melchior" | "balthazar" | "casper", "批准" | "否决">> = {};
    let completed = 0;
    for (const sage of sages) {
        updateProgress(Math.floor((completed / sages.length) * 100));
        const result = await collectSingleVote(sage, proposedAction);
        const voteField = resolveVoteFieldBySeelName(sage.config.name);
        // 仅在单贤者投票成功且名称可映射到维度字段时，才写入最终票箱。
        if (result && voteField) {
            ballots[voteField] = result[voteField];
        }
        completed += 1;
    }
    updateProgress(100);
    if (!ballots.melchior && !ballots.balthazar && !ballots.casper) {
        return null;
    }
    const merged: VoteResult = {
        melchior: ballots.melchior ?? "否决",
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
): Promise<VoteResult | null> {
    try {
        const voteResult = await seel.voteFor(proposedAction);
        const voteField = resolveVoteFieldBySeelName(seel.config.name);
        const decision = voteField && voteResult ? voteResult[voteField] : "否决";
        const voteMsg = await createMessage("vote", `${getMagiI18nText("evaluationCompleted")}: ${decision}`, {
            decision,
            round: voteResult?.round ?? 1,
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

/** 反刍循环入口（存根） */
export async function startRuminationLoop(
    userMessage: string,
    trinitySynthesis: string | null,
    vote: VoteResult,
): Promise<string> {
    const base = trinitySynthesis ?? userMessage;
    return `【反刍入口】当前提案未通过（第${vote.round}轮）。待进入反刍循环：${base}`;
}

/** 构造标准模式共识消息 */
function createStandardConsensus(synthesis: string): ConsensusMessage {
    return {
        type: "consensus",
        content: synthesis,
        status: "success",
        meta: { mode: "standard", source: "trinity-synthesis" },
        timestamp: Date.now(),
    };
}

/** 构造关键模式通过消息 */
function createCriticalPassedConsensus(synthesis: string, vote: VoteResult): ConsensusMessage {
    return {
        type: "consensus",
        content: synthesis,
        status: "success",
        meta: { mode: "critical", source: "trinity-synthesis", vote },
        timestamp: Date.now(),
    };
}

/** 构造失败时的兜底投票结果 */
function createFailedVote(voteResult: VoteResult | null): VoteResult {
    if (voteResult) {
        return voteResult;
    }
    return { melchior: "否决", balthazar: "否决", casper: "否决", passed: false, round: 1 };
}

/** 生成最终共识消息 */
export async function generateConsensusReply(
    trinityResult: string | null,
    voteResult: VoteResult | null,
    deliberationRequired: boolean,
    userMessage: string,
): Promise<ConsensusMessage> {
    const synthesis = trinityResult ?? getMagiI18nText("noConsensus");
    if (!deliberationRequired) {
        return createStandardConsensus(synthesis);
    }
    if (voteResult?.passed) {
        return createCriticalPassedConsensus(synthesis, voteResult);
    }
    const failedVote = createFailedVote(voteResult);
    const ruminationEntry = await startRuminationLoop(userMessage, trinityResult, failedVote);
    return {
        type: "consensus",
        content: ruminationEntry,
        status: "success",
        meta: { mode: "critical", source: "rumination-entry", vote: failedVote },
        timestamp: Date.now(),
    };
}
