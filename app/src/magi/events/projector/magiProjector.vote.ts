/**
 * MAGI 投票活动投影。
 *
 * 将投票事件压缩为主流进度、每贤人一条隐藏快照，以及可读结论/错误。
 */

/** 用途：主流投票消息契约。使用范围：进度消息构造。解耦评估：经网关只依赖视图类型。 */
import type { MagiMessage } from "./imports";
/** 用途：投影运行态。使用范围：全部投票处理器。解耦评估：经网关只依赖状态契约。 */
import type { MagiProjectorRuntimeState } from "./imports";
/** 用途：投票更新事件。使用范围：快照、结论与错误投影。解耦评估：经网关只依赖事件契约。 */
import type { MagiSeelVoteUpdatedEvent } from "./imports";
/** 用途：投票消息稳定 ID。使用范围：结论与错误活动。解耦评估：共享规则避免消息冲突。 */
import { buildProjectedMessageId } from "./magiProjector.shared";
/** 用途：查找投票贤者。使用范围：结论与错误活动。解耦评估：共享别名规则保持一致。 */
import { findSeelByName } from "./magiProjector.shared";
/** 用途：枚举三贤人卡片。使用范围：隐藏快照分发。解耦评估：共享规则统一排除 Trinity。 */
import { listSageSeels } from "./magiProjector.shared";
/** 用途：合并投票明细身份。使用范围：快照去重。解耦评估：共享别名规则保持一致。 */
import { normalizeSeelIdentity } from "./magiProjector.shared";
/** 用途：保留投票原始事件。使用范围：Trinity 监控。解耦评估：共享模块确保不污染贤人卡片。 */
import { projectRawEventToMonitor } from "./magiProjector.shared";
/** 用途：读取可展示理由。使用范围：投票进度和结论。解耦评估：共享边界读取规则。 */
import { readNonEmptyString } from "./magiProjector.shared";
/** 用途：读取上一轮快照元数据。使用范围：明细聚合。解耦评估：共享边界读取规则。 */
import { readRecord } from "./magiProjector.shared";
/** 用途：事件幂等登记。使用范围：投票入口。解耦评估：必须共享同一幂等集合。 */
import { shouldProcessEvent } from "./magiProjector.shared";
/** 用途：排序并原位更新投票消息。使用范围：全部投票流。解耦评估：共享线性流规则。 */
import { upsertMessage } from "./magiProjector.shared";

/** 投影投票进度到主消息流。 */
function projectVoteProgress(state: MagiProjectorRuntimeState, event: MagiSeelVoteUpdatedEvent) {
    if (typeof event.progress !== "number") {
        return;
    }
    const deliberationInitiator = readNonEmptyString(event.deliberationInitiator);
    const deliberationReason = readNonEmptyString(event.deliberationReason);
    const voteStatus: MagiMessage = {
        id: `${event.roundId}-vote-status`,
        type: "system",
        content: "投票进度更新",
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "vote-status",
            roundId: event.roundId,
            progress: event.progress,
            details: event.details ?? [],
            ...(typeof event.passed === "boolean" ? { passed: event.passed } : {}),
            ...(typeof event.round === "number" ? { round: event.round } : {}),
            ...(event.proposedAction ? { proposedAction: event.proposedAction } : {}),
            ...(deliberationInitiator ? { deliberationInitiator } : {}),
            ...(deliberationReason ? { deliberationReason } : {}),
        },
    };
    upsertMessage(state.target.consensusMessages, voteStatus);
}

/** 合并同一轮投票快照中的贤人明细。 */
function mergeVoteStateDetails(
    previousMeta: Record<string, unknown>,
    event: MagiSeelVoteUpdatedEvent,
) {
    const previousDetails = Reflect.get(previousMeta, "details");
    const details = Array.isArray(event.details)
        ? event.details.map((detail) => ({ ...detail }))
        : Array.isArray(previousDetails)
            ? previousDetails.filter((detail) => readRecord(detail)).map((detail) => ({ ...detail }))
            : [];
    const detailName = readNonEmptyString(event.displayName) ?? readNonEmptyString(event.seelName);
    if (!detailName || !event.decision) {
        return details;
    }
    const reason = readNonEmptyString(event.decisionReason) ?? readNonEmptyString(event.reason);
    const nextDetail = {
        name: detailName,
        decision: event.decision,
        ...(reason ? { reason } : {}),
    };
    const detailIndex = details.findIndex((detail) =>
        normalizeSeelIdentity(detail.name) === normalizeSeelIdentity(detailName));
    // 同一贤人的后续票据覆盖上一条，避免快照随原子事件无限增长。
    if (detailIndex >= 0) {
        details.splice(detailIndex, 1, nextDetail);
        return details;
    }
    details.push(nextDetail);
    return details;
}

/** 将一轮投票折叠为每张贤人卡片的一条隐藏状态快照，供徽标消费。 */
function projectVoteStateSnapshot(state: MagiProjectorRuntimeState, event: MagiSeelVoteUpdatedEvent) {
    const snapshotId = `${event.roundId}-vote-state`;
    for (const seel of listSageSeels(state.target.seels)) {
        const previous = seel.messages.find((message) => message.id === snapshotId);
        const previousMeta = readRecord(previous?.meta) ?? {};
        const details = mergeVoteStateDetails(previousMeta, event);
        upsertMessage(seel.messages, {
            id: snapshotId,
            type: "system",
            content: "投票状态已更新",
            status: "success",
            timestamp: event.timestamp,
            meta: {
                ...previousMeta,
                type: "vote-state",
                eventId: event.eventId,
                seq: event.seq,
                roundId: event.roundId,
                details,
                ...(typeof event.progress === "number" ? { progress: event.progress } : {}),
                ...(typeof event.passed === "boolean" ? { passed: event.passed } : {}),
                ...(typeof event.round === "number" ? { round: event.round } : {}),
                ...(event.proposedAction ? { proposedAction: event.proposedAction } : {}),
                ...(event.deliberationInitiator ? { deliberationInitiator: event.deliberationInitiator } : {}),
                ...(event.deliberationReason ? { deliberationReason: event.deliberationReason } : {}),
            },
        });
    }
}

/** 投影侧面投票结果到贤者卡片。 */
function projectVoteDecision(state: MagiProjectorRuntimeState, event: MagiSeelVoteUpdatedEvent) {
    const seelName = typeof event.seelName === "string" ? event.seelName : "";
    if (!seelName || !event.decision) {
        return;
    }
    const seel = findSeelByName(state.target.seels, seelName, event.displayName);
    if (!seel) {
        return;
    }
    const voteReason = readNonEmptyString(event.decisionReason) ?? readNonEmptyString(event.reason);
    upsertMessage(seel.messages, {
        id: buildProjectedMessageId(event.eventId, "vote"),
        type: "vote",
        content: voteReason
            ? `评估完成: ${event.decision} | 理由: ${voteReason}`
            : `评估完成: ${event.decision}`,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            decision: event.decision,
            ...(typeof event.round === "number" ? { round: event.round } : {}),
            ...(voteReason ? { reason: voteReason } : {}),
        },
    });
}

/** 投影侧面投票错误到贤者卡片。 */
function projectVoteError(state: MagiProjectorRuntimeState, event: MagiSeelVoteUpdatedEvent) {
    const seelName = typeof event.seelName === "string" ? event.seelName : "";
    const errorText = typeof event.error === "string" ? event.error : "";
    if (!seelName || !errorText) {
        return;
    }
    const seel = findSeelByName(state.target.seels, seelName, event.displayName);
    if (!seel) {
        return;
    }
    upsertMessage(seel.messages, {
        id: buildProjectedMessageId(event.eventId, "vote-error"),
        type: "error",
        content: errorText,
        status: "error",
        timestamp: event.timestamp,
    });
}

/** 投影投票更新事件。 */
/** @同步豁免: 生命周期 - 一次投票事件必须原子更新进度、隐藏快照和可读结论。 */
export function projectVoteUpdated(state: MagiProjectorRuntimeState, event: MagiSeelVoteUpdatedEvent) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_VOTE_UPDATED", event);
    projectVoteProgress(state, event);
    projectVoteStateSnapshot(state, event);
    projectVoteDecision(state, event);
    projectVoteError(state, event);
}
