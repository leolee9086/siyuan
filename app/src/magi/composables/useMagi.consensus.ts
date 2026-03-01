import type { ConnectionStatus, WrappedSeel } from "./useMagi.types";
import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import { createMessage } from "../utils/messageFactory";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    generateConsensusReply,
    handleTrinitySummary,
    processSagesResponses,
    processVoting,
    需要审慎决策,
} from "./magiConsensus";

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
): Promise<void> {
    const details = vote
        ? [
            { name: "MELCHIOR", decision: vote.melchior },
            { name: "BALTHASAR", decision: vote.balthazar },
            { name: "CASPER", decision: vote.casper },
        ]
        : [];
    await appendConsensusMessage(
        consensusMessages,
        "system",
        getMagiI18nText("evaluationCompleted"),
        { type: "vote-status", progress, details },
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
        );
    }
}

/** 执行可选投票链路并返回决策结果。 */
async function resolveVoteResult(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    userMessage: string,
    trinityResult: string | null,
    validResponses: SageResponse[],
): Promise<{ deliberationRequired: boolean; voteResult: VoteResult | null }> {
    const deliberationRequired = await 需要审慎决策(userMessage, validResponses);
    if (!deliberationRequired) {
        return { deliberationRequired, voteResult: null };
    }

    await appendVoteStatusMessage(consensusMessages, 0);
    const voteResult = await processVoting(
        sages,
        trinityResult ?? userMessage,
        (progress) => {
            void appendVoteStatusMessage(consensusMessages, progress);
        },
    );

    if (voteResult !== null) {
        await appendVoteStatusMessage(consensusMessages, 100, voteResult);
    }

    return { deliberationRequired, voteResult };
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

    await appendConsensusMessage(consensusMessages, "user", userMessage);
    const sages = seels.filter((seel) => seel.config.name !== "TRINITY-00");
    const trinity = seels.find((seel) => seel.config.name === "TRINITY-00") ?? null;

    // 三贤者为空时后续流程无法成立，必须提前兜底退出。
    if (sages.length === 0) {
        await appendConsensusMessage(consensusMessages, "error", "未找到可用贤者，无法完成共识流程");
        return;
    }

    try {
        const validResponses = await processSagesResponses(sages, userMessage);
        await appendSageResponses(consensusMessages, validResponses);

        // 三贤者全部失败或返回空内容时，终止本轮并给出可见错误，避免继续进入 Trinity/投票产生误导结果。
        if (validResponses.length === 0) {
            await appendConsensusMessage(consensusMessages, "error", getMagiI18nText("noConsensus"));
            return;
        }

        const trinityResult = trinity
            ? await handleTrinitySummary(validResponses, trinity, userMessage)
            : validResponses.map((response) => response.content).join("\n");
        const { deliberationRequired, voteResult } = await resolveVoteResult(
            consensusMessages,
            sages,
            userMessage,
            trinityResult,
            validResponses,
        );
        await appendFinalConsensus(
            consensusMessages,
            trinityResult,
            voteResult,
            deliberationRequired,
            userMessage,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendConsensusMessage(
            consensusMessages,
            "error",
            `共识链路异常，已执行兜底并结束本轮: ${message}`,
        );
    }
}
