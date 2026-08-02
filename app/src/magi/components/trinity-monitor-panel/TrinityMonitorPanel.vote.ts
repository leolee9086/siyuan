/** 用途：监控消息视图。使用范围：投票事件聚合。解耦评估：经目录网关隔离父级路径。 */
import type { MagiSeelPanelMessageView } from "./imports";
/** 用途：投票聚合状态。使用范围：单轮扫描。解耦评估：同目录稳定类型。 */
import type { MagiMonitorVoteAccumulator } from "./TrinityMonitorPanel.types";
/** 用途：投票明细视图。使用范围：结果排序。解耦评估：同目录稳定类型。 */
import type { MagiMonitorVoteDetail } from "./TrinityMonitorPanel.types";
/** 用途：监控色调类型。使用范围：投票摘要。解耦评估：同目录稳定类型。 */
import type { MagiMonitorTone } from "./TrinityMonitorPanel.types";
/** 用途：创建局部投票状态。使用范围：每次摘要提取。解耦评估：对象创建集中到 factory。 */
import { createVoteAccumulator } from "./TrinityMonitorPanel.factory";
/** 用途：收窄投票明细对象。使用范围：details 解析。解耦评估：共享边界读取规则。 */
import { asRecord } from "./TrinityMonitorPanel.shared";
/** 用途：格式化投票更新时间。使用范围：摘要。解耦评估：共享时间规则。 */
import { formatMonitorTimestamp } from "./TrinityMonitorPanel.shared";
/** 用途：读取投票轮次。使用范围：当前轮次筛选。解耦评估：共享协议解析。 */
import { getRawEventRoundId } from "./TrinityMonitorPanel.shared";
/** 用途：读取投票事件类型。使用范围：投票过滤。解耦评估：共享协议解析。 */
import { getRawEventType } from "./TrinityMonitorPanel.shared";
/** 用途：识别原始事件。使用范围：投票过滤。解耦评估：共享协议解析。 */
import { isRawEventMonitorMessage } from "./TrinityMonitorPanel.shared";
/** 用途：归一化贤人身份。使用范围：投票去重。解耦评估：共享别名规则。 */
import { normalizeSeelIdentity } from "./TrinityMonitorPanel.shared";
/** 用途：读取投票载荷。使用范围：轮次聚合。解耦评估：共享协议解析。 */
import { readRawEventPayload } from "./TrinityMonitorPanel.shared";
/** 用途：读取投票元数据。使用范围：事件 token。解耦评估：共享协议解析。 */
import { readRawEventMeta } from "./TrinityMonitorPanel.shared";
/** 用途：读取非空文本。使用范围：投票字段。解耦评估：共享边界收窄规则。 */
import { readNonEmptyString } from "./TrinityMonitorPanel.shared";

/** 判断消息是否属于原始投票事件。 */
function isRawVoteEventMessage(message: MagiSeelPanelMessageView) {
    return isRawEventMonitorMessage(message) && getRawEventType(message) === "SEEL_VOTE_UPDATED";
}

/** 查找最近一条投票事件。 */
function findLatestVoteEvent(messages: readonly MagiSeelPanelMessageView[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message && isRawVoteEventMessage(message)) {
            return message;
        }
    }
    return null;
}

/** 构造投票事件稳定 token。 */
function readVoteEventToken(message: MagiSeelPanelMessageView) {
    const meta = readRawEventMeta(message);
    const eventId = readNonEmptyString(Reflect.get(meta, "eventId")) ?? message.id;
    const seq = Reflect.get(meta, "seq");
    return `${eventId}:${typeof seq === "number" ? seq : "?"}`;
}

/** 读取优先级一致的投票理由。 */
function readVoteDecisionReason(payload: Record<string, unknown>) {
    return readNonEmptyString(Reflect.get(payload, "decisionReason"))
        ?? readNonEmptyString(Reflect.get(payload, "reason"));
}

/** 返回面板显示用的贤人名称。 */
function resolveVoteDetailName(value: unknown) {
    const normalized = normalizeSeelIdentity(value);
    if (normalized === "MELCHIOR") {
        return "Melchior";
    }
    if (normalized === "BALTHASAR") {
        return "Balthazar";
    }
    if (normalized === "CASPER") {
        return "Casper";
    }
    return readNonEmptyString(value) ?? "Unknown";
}

/** 合并载荷内批量投票明细。 */
function mergePayloadDetails(
    accumulator: MagiMonitorVoteAccumulator,
    payload: Record<string, unknown>,
) {
    const detailList = Reflect.get(payload, "details");
    if (!Array.isArray(detailList)) {
        return;
    }
    for (const item of detailList) {
        const detail = asRecord(item);
        const name = resolveVoteDetailName(detail ? Reflect.get(detail, "name") : undefined);
        const key = normalizeSeelIdentity(name);
        const decision = readNonEmptyString(detail ? Reflect.get(detail, "decision") : undefined);
        if (!key || !decision) {
            continue;
        }
        accumulator.details.set(key, {
            key,
            name,
            decision,
            reason: readNonEmptyString(detail ? Reflect.get(detail, "reason") : undefined) ?? "",
        });
    }
}

/** 合并单贤人投票字段。 */
function mergeDirectVote(
    accumulator: MagiMonitorVoteAccumulator,
    payload: Record<string, unknown>,
) {
    const name = readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? readNonEmptyString(Reflect.get(payload, "displayName"));
    const decision = readNonEmptyString(Reflect.get(payload, "decision"));
    const key = normalizeSeelIdentity(name);
    if (!name || !decision || !key) {
        return;
    }
    accumulator.details.set(key, {
        key,
        name: resolveVoteDetailName(name),
        decision,
        reason: readVoteDecisionReason(payload) ?? "",
    });
}

/** 把单条投票载荷并入轮次状态。 */
function mergeVotePayload(
    accumulator: MagiMonitorVoteAccumulator,
    payload: Record<string, unknown>,
) {
    const progress = Reflect.get(payload, "progress");
    const round = Reflect.get(payload, "round");
    const passed = Reflect.get(payload, "passed");
    if (typeof progress === "number") {
        accumulator.progress = progress;
    }
    if (typeof round === "number") {
        accumulator.round = round;
    }
    if (typeof passed === "boolean") {
        accumulator.passed = passed;
    }
    accumulator.proposedAction = readNonEmptyString(Reflect.get(payload, "proposedAction"))
        ?? accumulator.proposedAction;
    accumulator.deliberationInitiator = readNonEmptyString(Reflect.get(payload, "deliberationInitiator"))
        ?? accumulator.deliberationInitiator;
    accumulator.deliberationReason = readNonEmptyString(Reflect.get(payload, "deliberationReason"))
        ?? accumulator.deliberationReason;
    mergePayloadDetails(accumulator, payload);
    mergeDirectVote(accumulator, payload);
}

/** 根据明细计算缺省通过状态。 */
function computeVotePassed(details: Map<string, MagiMonitorVoteDetail>) {
    let approveCount = 0;
    let rejectCount = 0;
    for (const detail of details.values()) {
        // 明确批准的票计入多数通过判断。
        if (detail.decision === "批准") {
            approveCount += 1;
        }
        // 明确否决的票计入多数否决判断。
        if (detail.decision === "否决") {
            rejectCount += 1;
        }
    }
    return approveCount + rejectCount === 0 ? undefined : approveCount >= 2;
}

/** 按固定贤人顺序输出明细。 */
function orderVoteDetails(details: Map<string, MagiMonitorVoteDetail>) {
    const ordered: MagiMonitorVoteDetail[] = [];
    for (const key of ["MELCHIOR", "BALTHASAR", "CASPER"]) {
        const detail = details.get(key);
        if (detail) {
            ordered.push(detail);
        }
    }
    return ordered;
}

/** 返回投票状态文案。 */
function resolveVoteStatusLabel(passed: boolean | undefined, progress: number) {
    if (passed === true) {
        return "通过";
    }
    if (passed === false) {
        return "未通过";
    }
    return progress >= 100 ? "审议结束" : "审议中";
}

/** @同步豁免: UI构建 - 投票摘要必须在当前 computed 周期同步聚合。 */
export function extractLatestVoteSummary(messages: readonly MagiSeelPanelMessageView[]) {
    const latest = findLatestVoteEvent(messages);
    if (!latest) {
        return null;
    }
    const roundId = getRawEventRoundId(latest);
    if (roundId === "-") {
        return null;
    }
    const accumulator = createVoteAccumulator();
    for (const message of messages) {
        // 只合并最近投票所处轮次的原始投票事件，避免跨轮污染摘要。
        if (message && isRawVoteEventMessage(message) && getRawEventRoundId(message) === roundId) {
            mergeVotePayload(accumulator, readRawEventPayload(message));
        }
    }
    const passed = accumulator.passed ?? computeVotePassed(accumulator.details);
    const tone: MagiMonitorTone = passed === true ? "good" : passed === false ? "danger" : "warn";
    return {
        token: readVoteEventToken(latest),
        roundId,
        ...(typeof accumulator.round === "number" ? { round: accumulator.round } : {}),
        progress: accumulator.progress,
        tone,
        statusLabel: resolveVoteStatusLabel(passed, accumulator.progress),
        proposedAction: accumulator.proposedAction,
        deliberationInitiator: accumulator.deliberationInitiator,
        deliberationReason: accumulator.deliberationReason,
        updatedAt: formatMonitorTimestamp(latest.timestamp),
        details: orderVoteDetails(accumulator.details),
    };
}
