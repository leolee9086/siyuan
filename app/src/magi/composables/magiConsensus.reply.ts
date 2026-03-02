import type { ConsensusMessage, VoteResult } from "../utils/messageFactory.types";
import { getMagiI18nText } from "../utils/magiI18n";

/** 反刍循环入口（存根） */
async function startRuminationLoop(
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
