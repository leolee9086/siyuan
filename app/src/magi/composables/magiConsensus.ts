/**
 * MAGI贤者响应处理与共识生成
 *
 * 从 toread/MAGI/composables/useMagi.js 中的业务逻辑函数迁移。
 * 包含贤者响应收集、投票处理、Trinity总结和共识生成。
 */

// [TASK] T2.2 迁移composables和工具函数 - magiConsensus

import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { WrappedSeel } from "./useMagi.types";
import { createMessage } from "../utils/messageFactory";
import { processStreamResponse } from "../utils/streamProcessor";
import { isSageResponse } from "./magiConsensus.guard";
import { getMagiI18nText } from "../utils/magiI18n";

// ────────────────────────────────────────────────────────────────────────────
// 内部辅助函数
// ────────────────────────────────────────────────────────────────────────────

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
    // 已存在同ID消息时就地更新，避免重复插入
    if (existing) {
        Object.assign(existing, msg);
        return;
    }
    seel.messages.push({ ...msg });
}

// ────────────────────────────────────────────────────────────────────────────
// 贤者响应收集
// ────────────────────────────────────────────────────────────────────────────

/**
 * 收集所有贤者对用户消息的响应
 *
 * 并发调用每个贤者的 reply()，通过流式处理收集响应内容，
 * 过滤掉失败的响应后返回有效结果列表。
 */
export async function processSagesResponses(
    sages: WrappedSeel[],
    userMessage: string,
): Promise<SageResponse[]> {
    const responsePromises = sages.map(
        (seel) => collectSingleSageResponse(seel, userMessage),
    );

    const results = await Promise.all(responsePromises);
    return results.filter(isSageResponse);
}

/**
 * 收集单个贤者的响应
 *
 * 作用：调用贤者reply()并通过流式处理收集完整响应
 * 意图：隔离单个贤者的错误，不影响其他贤者的并发处理
 * 调用时机：由 processSagesResponses 并发调用
 */
async function collectSingleSageResponse(
    seel: WrappedSeel,
    userMessage: string,
): Promise<SageResponse | null> {
    try {
        await syncOriginalMessages(seel);
        const response = await seel.reply(userMessage);

        const callbacks = buildStreamCallbacks(seel, userMessage);
        const { content, success } = await processStreamResponse(response, callbacks);

        // 流处理成功时返回贤者响应
        if (success) {
            return {
                content,
                seel: seel.config.name,
                displayName: seel.config.displayName,
            };
        }
        return null;
    } catch {
        seel.loading = false;
        return null;
    }
}

/**
 * 构建流式处理回调集合
 *
 * 作用：为单个贤者的流式响应创建标准回调
 * 意图：将回调构建逻辑从 collectSingleSageResponse 中提取，降低函数复杂度
 */
function buildStreamCallbacks(seel: WrappedSeel, userMessage: string) {
    return {
        /** 流开始：标记loading并追加用户消息 */
        onStart: () => {
            seel.loading = true;
            void appendUserMessage(seel, userMessage);
        },
        /** 收到chunk：按ID更新或插入消息 */
        onChunk: (msg: MagiMessage) => {
            void upsertMessage(seel, msg);
        },
        /** 流完成：取消loading状态 */
        onComplete: () => {
            seel.loading = false;
        },
        /** 流出错：取消loading并追加错误消息 */
        onError: async (error: Error) => {
            seel.loading = false;
            const errMsg = await createMessage("error", error.message);
            seel.messages.push(errMsg);
        },
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Trinity总结
// ────────────────────────────────────────────────────────────────────────────

/**
 * 处理Trinity对所有贤者响应的总结
 *
 * 作用：将有效响应传给Trinity实例，由其生成综合总结
 * 意图：Trinity作为仲裁者，综合三贤人的观点给出最终回答
 * 调用时机：所有贤者响应收集完成后、投票之前或之后
 *
 * @param validResponses - 有效的贤者响应列表
 * @param trinity - Trinity包装实例
 * @param userMessage - 原始用户消息
 * @returns Trinity总结内容，失败时返回null
 */
export async function handleTrinitySummary(
    validResponses: SageResponse[],
    trinity: WrappedSeel,
    userMessage: string,
): Promise<string | null> {
    if (validResponses.length === 0) {
        return null;
    }

    try {
        const trinityContext = { context: { responses: validResponses } };
        const trinityResponse = await trinity.reply(userMessage, trinityContext);

        const callbacks = buildStreamCallbacks(trinity, userMessage);
        const { content, success } = await processStreamResponse(trinityResponse, callbacks);

        return success ? content : null;
    } catch {
        trinity.loading = false;
        const errMsg = await createMessage("error", getMagiI18nText("responseGenerationFailed"));
        trinity.messages.push(errMsg);
        return null;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 投票处理
// ────────────────────────────────────────────────────────────────────────────

/**
 * 执行贤者投票流程
 *
 * 作用：依次让每个贤者对所有有效响应进行投票评分
 * 意图：通过多方评估实现MAGI共识机制
 * 调用时机：贤者响应收集完成后
 *
 * @param sages - 参与投票的贤者列表
 * @param validResponses - 待评估的有效响应
 * @param updateProgress - 进度更新回调（0-100）
 */
export async function processVoting(
    sages: WrappedSeel[],
    validResponses: SageResponse[],
    updateProgress: (progress: number) => void,
): Promise<VoteResult[]> {
    const voteResults: VoteResult[] = [];
    const responseContents = validResponses.map((r) => r.content);
    let completed = 0;

    for (const sage of sages) {
        const progress = Math.floor((completed / sages.length) * 100);
        updateProgress(progress);

        const result = await collectSingleVote(sage, responseContents);
        // 仅收集成功的投票结果
        if (result) {
            voteResults.push(result);
        }
        completed += 1;
    }

    return voteResults;
}

/**
 * 收集单个贤者的投票结果
 *
 * 作用：调用贤者的voteFor方法并记录投票消息
 * 意图：隔离单个贤者的投票错误，不影响整体投票流程
 * 调用时机：由 processVoting 在循环中调用
 */
async function collectSingleVote(
    seel: WrappedSeel,
    responseContents: string[],
): Promise<VoteResult | null> {
    try {
        const voteResult = await seel.voteFor(responseContents);
        const voteMsg = await createMessage("vote", getMagiI18nText("evaluationCompleted"), {
            ...(voteResult ?? { scores: [], conclusion: "error" }),
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

// ────────────────────────────────────────────────────────────────────────────
// 共识生成
// ────────────────────────────────────────────────────────────────────────────

/**
 * 根据投票结果生成共识消息
 *
 * 作用：将各贤者的投票评分加权汇总，生成最终共识
 * 意图：实现MAGI系统的民主决策机制——Trinity直接总结优先，否则取加权最高分
 * 调用时机：投票完成后，作为最终结果展示
 *
 * @param validResponses - 有效的贤者响应
 * @param trinityResult - Trinity总结内容（可能为null）
 * @param voteResults - 各贤者的投票结果
 * @param sagesCount - 参与投票的贤者数量
 */
export async function generateConsensusReply(
    validResponses: SageResponse[],
    trinityResult: string | null,
    voteResults: VoteResult[],
    sagesCount: number,
): Promise<Record<string, unknown>> {
    const weightedResults = computeWeightedResults(
        validResponses, voteResults, sagesCount,
    );

    const topResult = weightedResults[0];
    const topContent = topResult?.content ?? getMagiI18nText("noConsensus");

    return {
        type: "consensus",
        content: trinityResult ?? topContent,
        status: "success",
        meta: {
            source: trinityResult ? "trinity" : "weighted",
            weights: weightedResults.map((w) => w.weight),
            details: weightedResults,
        },
        timestamp: Date.now(),
    };
}

/** 计算加权排序后的响应列表 */
function computeWeightedResults(
    validResponses: SageResponse[],
    voteResults: VoteResult[],
    sagesCount: number,
): Array<{ content: SageResponse; weight: number }> {
    return validResponses
        .map((content, index) => ({
            content,
            weight: computeSingleWeight(voteResults, index, sagesCount),
        }))
        .sort((a, b) => b.weight - a.weight);
}

/** 计算单个响应的加权得分 */
function computeSingleWeight(
    voteResults: VoteResult[],
    index: number,
    sagesCount: number,
): number {
    const totalScore = voteResults
        .filter((v) => v?.scores)
        .reduce((acc, cur) => {
            const entry = cur.scores[index];
            return acc + (entry?.score ?? 0);
        }, 0);
    return totalScore / sagesCount;
}
