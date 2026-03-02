import type { ConnectionStatus, WrappedSeel } from "./useMagi.types";
import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import { createMessage } from "../utils/messageFactory";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    handleTrinitySummary,
    processSagesResponses,
    processVoting,
    需要审慎决策,
} from "./magiConsensus";
import { generateConsensusReply } from "./magiConsensus.reply";
import {
    handleTrinityPostActionSummary,
    执行梅基奥尔主导行动,
    生成梅基奥尔行动提案,
} from "./magiConsensus.deliberation";

/** 追加消息到主消息流并统一状态字段。 */
export async function appendConsensusMessage(
    consensusMessages: MagiMessage[],
    type: string,
    content: string,
    meta?: Record<string, unknown>,
): Promise<void> {
    const msg = await createMessage(type, content, meta);
    msg.status = type === "error" ? "error" : "success";
    consensusMessages.push(msg);
}

/** 追加投票状态消息，兼容现有主面板 vote-status 展示。 */
async function appendVoteStatusMessage(
    consensusMessages: MagiMessage[],
    progress: number,
    vote?: VoteResult,
    proposedAction?: string,
): Promise<void> {
    const details = vote
        ? [
            { name: "MELCHIOR", decision: vote.melchior },
            { name: "BALTHASAR", decision: vote.balthazar },
            { name: "CASPER", decision: vote.casper },
        ]
        : [];
    const meta: Record<string, unknown> = {
        type: "vote-status",
        progress,
        details,
        ...(proposedAction ? { proposedAction } : {}),
    };
    await appendConsensusMessage(
        consensusMessages,
        "system",
        getMagiI18nText("evaluationCompleted"),
        meta,
    );
}

/** 追加三贤者有效响应，保持既有消息结构。 */
async function appendSageResponses(
    consensusMessages: MagiMessage[],
    validResponses: SageResponse[],
): Promise<void> {
    for (const response of validResponses) {
        await appendConsensusMessage(
            consensusMessages,
            "consensus",
            `${response.displayName}: ${response.content}`,
            {
                type: "sage-response",
                seel: response.seel,
                displayName: response.displayName,
                ...(typeof response.requiresDeliberation === "boolean"
                    ? { requiresDeliberation: response.requiresDeliberation }
                    : {}),
            },
        );
    }
}

/** 执行审慎决策投票链路并返回决策结果。 */
async function resolveVoteResult(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    validResponses: SageResponse[],
    userMessage: string,
): Promise<{ deliberationRequired: boolean; voteResult: VoteResult | null; proposedAction: string | null }> {
    const deliberationRequired = await 需要审慎决策(validResponses);
    if (!deliberationRequired) {
        return { deliberationRequired, voteResult: null, proposedAction: null };
    }

    const proposedAction = await 生成梅基奥尔行动提案(sages, validResponses, userMessage);
    const melchiorConclusion =
        validResponses.find((response) => response.seel.includes("MELCHIOR"))?.content ?? "无附加判断";
    await appendVoteStatusMessage(consensusMessages, 0, undefined, proposedAction);
    const voteResult = await processVoting(
        sages,
        proposedAction,
        { userMessage, melchiorConclusion },
        (progress) => {
            void appendVoteStatusMessage(consensusMessages, progress, undefined, proposedAction);
        },
    );

    if (voteResult !== null) {
        await appendVoteStatusMessage(consensusMessages, 100, voteResult, proposedAction);
    }

    return { deliberationRequired, voteResult, proposedAction };
}

/** 收集并落盘贤者响应；若全部无效则写入错误并返回 null。 */
async function collectValidResponses(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    userMessage: string,
): Promise<SageResponse[] | null> {
    const validResponses = await processSagesResponses(sages, userMessage);
    await appendSageResponses(consensusMessages, validResponses);

    // 三贤者全部失败或返回空内容时，终止本轮并给出可见错误，避免继续进入 Trinity/投票产生误导结果。
    if (validResponses.length === 0) {
        await appendConsensusMessage(consensusMessages, "error", getMagiI18nText("noConsensus"));
        return null;
    }
    return validResponses;
}

/** 根据分支条件生成本轮 Trinity 输出文本。 */
async function resolveTrinityResult(
    deliberationRequired: boolean,
    voteResult: VoteResult | null,
    proposedAction: string | null,
    userMessage: string,
    sages: WrappedSeel[],
    trinity: WrappedSeel | null,
    validResponses: SageResponse[],
): Promise<string | null> {
    if (!deliberationRequired && !trinity) {
        return validResponses.map((response) => response.content).join("\n");
    }
    if (!deliberationRequired) {
        return handleTrinitySummary(validResponses, trinity, userMessage);
    }
    if (!voteResult?.passed) {
        // 审慎决策未通过时，不进入主导执行分支，交由后续反刍入口处理。
        return null;
    }

    const action = proposedAction ?? userMessage;
    const melchiorActionResult = await 执行梅基奥尔主导行动(sages, userMessage, action);
    const safeActionResult = melchiorActionResult ?? "已进入执行阶段，但暂未产生可见输出。";
    if (!trinity) {
        return safeActionResult;
    }
    return handleTrinityPostActionSummary(
        validResponses,
        trinity,
        action,
        voteResult,
        safeActionResult,
        userMessage,
    );
}

/** 执行单轮完整共识计算并写入消息流。 */
async function runConsensusRound(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    trinity: WrappedSeel | null,
    userMessage: string,
): Promise<void> {
    const validResponses = await collectValidResponses(consensusMessages, sages, userMessage);
    if (!validResponses) {
        return;
    }
    const { deliberationRequired, voteResult, proposedAction } = await resolveVoteResult(
        consensusMessages,
        sages,
        validResponses,
        userMessage,
    );
    const trinityResult = await resolveTrinityResult(
        deliberationRequired,
        voteResult,
        proposedAction,
        userMessage,
        sages,
        trinity,
        validResponses,
    );
    await appendFinalConsensus(
        consensusMessages,
        trinityResult,
        voteResult,
        deliberationRequired,
        userMessage,
    );
}

/** 生成最终共识消息并写入主消息流。 */
async function appendFinalConsensus(
    consensusMessages: MagiMessage[],
    trinityResult: string | null,
    voteResult: VoteResult | null,
    deliberationRequired: boolean,
    userMessage: string,
): Promise<void> {
    const consensusReply = await generateConsensusReply(
        trinityResult,
        voteResult,
        deliberationRequired,
        userMessage,
    );
    const finalMessage = await createMessage(
        consensusReply.type,
        consensusReply.content,
        consensusReply.meta,
    );
    finalMessage.status = consensusReply.status;
    finalMessage.timestamp = consensusReply.timestamp;
    consensusMessages.push(finalMessage);
}

/**
 * 发送用户消息并执行完整共识链路（T2.2 Step A）。
 * 作用：三贤者响应 -> Trinity 统合 -> 可选投票 -> 最终共识落盘。
 * 调用时机：输入栏 submit 事件触发后。
 */
export async function sendUserMessageWithConsensus(
    text: string,
    connectionStatus: { value: ConnectionStatus },
    consensusMessages: MagiMessage[],
    seels: WrappedSeel[],
): Promise<void> {
    const userMessage = text.trim();
    if (!userMessage || connectionStatus.value !== "connected") {
        return;
    }
    await appendConsensusMessage(
        consensusMessages,
        "user",
        userMessage,
        { type: "round-input" },
    );
    const sages = seels.filter((seel) => seel.config.name !== "TRINITY-00");
    const trinity = seels.find((seel) => seel.config.name === "TRINITY-00") ?? null;
    // 三贤者为空时后续流程无法成立，必须提前兜底退出。
    if (sages.length === 0) {
        await appendConsensusMessage(consensusMessages, "error", "未找到可用贤者，无法完成共识流程");
        return;
    }
    try {
        await runConsensusRound(consensusMessages, sages, trinity, userMessage);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendConsensusMessage(
            consensusMessages,
            "error",
            `共识链路异常，已执行兜底并结束本轮: ${message}`,
        );
    }
}
