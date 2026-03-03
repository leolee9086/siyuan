import type { WrappedSeel } from "../useMagi.types";
import type { MagiMessage } from "../../utils/messageFactory.types";
import { createMagiRoundId } from "../../events/magiEventBus";
import type { MagiEventBus, MagiRoundEventContext } from "../../events/magiEventBus.types";

let activeRoundEventContext: MagiRoundEventContext | null = null;

/** 激活一轮事件上下文；无 eventBus 时清空上下文。 */
export async function activateMagiRoundEventContext(
    eventBus: MagiEventBus | undefined,
    userInput: string,
): Promise<void> {
    if (!eventBus) {
        activeRoundEventContext = null;
        return;
    }
    const roundId = await createMagiRoundId();
    activeRoundEventContext = { eventBus, roundId };
    eventBus.emit("ROUND_STARTED", {
        roundId,
        timestamp: Date.now(),
        userInput,
    });
}

/** 清理当前轮次事件上下文。 */
export async function deactivateMagiRoundEventContext(): Promise<void> {
    activeRoundEventContext = null;
}

/** 发布轮次失败事件。 */
export async function publishRoundFailed(error: string): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("ROUND_FAILED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: Date.now(),
        error,
    });
    return true;
}

/** 发布主消息流事件。 */
export async function publishConsensusMessage(message: MagiMessage): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("CONSENSUS_EMITTED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: message.timestamp,
        message,
    });
    return true;
}

/** 发布 Trinity 统合完成事件。 */
export async function publishTrinitySynthesis(
    content: string,
    timestamp: number,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("TRINITY_SYNTHESIS_COMPLETED", {
        roundId: activeRoundEventContext.roundId,
        timestamp,
        content,
    });
    return true;
}

/** 发布投票进度事件。 */
export async function publishVoteProgress(
    progress: number,
    details: Array<{ name: string; decision: string }>,
    proposedAction?: string,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_VOTE_UPDATED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: Date.now(),
        progress,
        details,
        ...(proposedAction ? { proposedAction } : {}),
    });
    return true;
}

/** 发布贤者开始回复事件。 */
export async function publishSeelReplyStarted(
    seel: WrappedSeel,
    userInput: string,
    streamMessage: MagiMessage,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_REPLY_STARTED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: streamMessage.timestamp,
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        userInput,
        streamMessage,
    });
    return true;
}

/** 发布贤者流式增量事件。 */
export async function publishSeelReplyChunk(
    seel: WrappedSeel,
    message: MagiMessage,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_REPLY_CHUNK", {
        roundId: activeRoundEventContext.roundId,
        timestamp: message.timestamp,
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        message,
    });
    return true;
}

/** 发布贤者回复完成事件。 */
export async function publishSeelReplyCompleted(
    seel: WrappedSeel,
    message: MagiMessage,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_REPLY_COMPLETED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: message.timestamp,
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        message,
    });
    return true;
}

/** 发布贤者回复失败事件。 */
export async function publishSeelReplyFailed(
    seel: WrappedSeel,
    error: string,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_REPLY_FAILED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: Date.now(),
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        error,
    });
    return true;
}

/** 发布贤者投票结果事件。 */
export async function publishSeelVoteDecision(
    seel: WrappedSeel,
    decision: "批准" | "否决",
    round: number,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_VOTE_UPDATED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: Date.now(),
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        decision,
        round,
    });
    return true;
}

/** 发布贤者投票错误事件。 */
export async function publishSeelVoteError(
    seel: WrappedSeel,
    error: string,
): Promise<boolean> {
    if (!activeRoundEventContext) {
        return false;
    }
    activeRoundEventContext.eventBus.emit("SEEL_VOTE_UPDATED", {
        roundId: activeRoundEventContext.roundId,
        timestamp: Date.now(),
        seelName: seel.config.name,
        displayName: seel.config.displayName,
        error,
    });
    return true;
}
