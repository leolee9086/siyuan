/**
 * SeelPanelVoteContent 组件逻辑上下文
 *
 * 投票消息的结论解析与时间格式化。
 */

import { computed } from "vue";
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";
import { getMagiI18nText } from "../../utils/magiI18n";
import type {
    SeelVoteBadgeState,
    SeelVoteDetailState,
    SeelVoteRoundState,
    VoteMeta,
} from "./SeelPanel.types";

/** 格式化时间戳为 HH:MM:SS */
export async function formatVoteTime(ts: number): Promise<string> {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/** 提取可展示的投票理由。 */
function resolveVoteReason(meta: VoteMeta): string {
    if (typeof meta.reason === "string" && meta.reason.trim().length > 0) {
        return meta.reason.trim();
    }
    return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSeelIdentity(value: unknown): string {
    const raw = readNonEmptyString(value);
    if (!raw) {
        return "";
    }
    const normalized = raw.toUpperCase();
    if (normalized.includes("MELCHIOR")) {
        return "MELCHIOR";
    }
    if (normalized.includes("BALTHASAR") || normalized.includes("BALTHAZAR")) {
        return "BALTHASAR";
    }
    if (normalized.includes("CASPER")) {
        return "CASPER";
    }
    return normalized.replace(/[^A-Z0-9]/g, "");
}

function isVoteStateMessage(message: MagiSeelPanelMessageView): boolean {
    const meta = isRecord(message.meta) ? message.meta : null;
    const isRawVoteEvent = message.type === "event"
        && meta?.type === "raw-event"
        && meta?.eventType === "SEEL_VOTE_UPDATED";
    return isRawVoteEvent || meta?.type === "vote-state";
}

function readVoteEventPayload(message: MagiSeelPanelMessageView): Record<string, unknown> {
    const meta = isRecord(message.meta) ? message.meta : null;
    if (meta?.type === "vote-state") {
        return meta;
    }
    const payload = meta ? Reflect.get(meta, "eventPayload") : undefined;
    return isRecord(payload) ? payload : {};
}

function readVoteRoundId(message: MagiSeelPanelMessageView): string {
    const meta = isRecord(message.meta) ? message.meta : null;
    return readNonEmptyString(meta ? Reflect.get(meta, "roundId") : undefined) ?? "";
}

function readVoteEventToken(message: MagiSeelPanelMessageView): string {
    const meta = isRecord(message.meta) ? message.meta : null;
    const eventId = readNonEmptyString(meta ? Reflect.get(meta, "eventId") : undefined) ?? message.id;
    const seq = meta ? Reflect.get(meta, "seq") : undefined;
    return `${eventId}:${typeof seq === "number" ? seq : "?"}`;
}

function upsertVoteDetail(
    details: Map<string, SeelVoteDetailState>,
    name: string,
    decision: string,
    reason?: string,
): void {
    const normalizedName = normalizeSeelIdentity(name);
    if (!normalizedName) {
        return;
    }
    details.set(normalizedName, {
        name,
        normalizedName,
        decision,
        ...(reason ? { reason } : {}),
    });
}

function applyVoteEventToState(
    state: SeelVoteRoundState,
    payload: Record<string, unknown>,
): void {
    const proposedAction = readNonEmptyString(Reflect.get(payload, "proposedAction"));
    if (proposedAction) {
        state.proposedAction = proposedAction;
    }

    const deliberationInitiator = readNonEmptyString(Reflect.get(payload, "deliberationInitiator"));
    if (deliberationInitiator) {
        state.deliberationInitiator = deliberationInitiator;
    }

    const deliberationReason = readNonEmptyString(Reflect.get(payload, "deliberationReason"));
    if (deliberationReason) {
        state.deliberationReason = deliberationReason;
    }

    const details = Reflect.get(payload, "details");
    if (Array.isArray(details)) {
        for (const item of details) {
            const detail = isRecord(item) ? item : null;
            const name = readNonEmptyString(detail ? Reflect.get(detail, "name") : undefined);
            const decision = readNonEmptyString(detail ? Reflect.get(detail, "decision") : undefined);
            const reason = readNonEmptyString(detail ? Reflect.get(detail, "reason") : undefined);
            if (!name || !decision) {
                continue;
            }
            upsertVoteDetail(state.details, name, decision, reason);
        }
    }

    const seelName = readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? readNonEmptyString(Reflect.get(payload, "displayName"));
    const decision = readNonEmptyString(Reflect.get(payload, "decision"));
    const reason = readNonEmptyString(Reflect.get(payload, "decisionReason"))
        ?? readNonEmptyString(Reflect.get(payload, "reason"));
    if (seelName && decision) {
        upsertVoteDetail(state.details, seelName, decision, reason);
    }
}

function collectLatestVoteRoundState(
    messages: readonly MagiSeelPanelMessageView[],
): SeelVoteRoundState | null {
    let latestVoteEvent: MagiSeelPanelMessageView | null = null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message && isVoteStateMessage(message)) {
            latestVoteEvent = message;
            break;
        }
    }
    if (!latestVoteEvent) {
        return null;
    }

    const roundId = readVoteRoundId(latestVoteEvent);
    if (!roundId) {
        return null;
    }

    const state: SeelVoteRoundState = {
        token: readVoteEventToken(latestVoteEvent),
        roundId,
        details: new Map<string, SeelVoteDetailState>(),
    };

    for (const message of messages) {
        if (!message || !isVoteStateMessage(message) || readVoteRoundId(message) !== roundId) {
            continue;
        }
        applyVoteEventToState(state, readVoteEventPayload(message));
    }
    return state;
}

function buildVoteBadgeTooltip(
    state: SeelVoteRoundState,
    detail?: SeelVoteDetailState,
): string {
    const lines = [
        `轮次: ${state.roundId}`,
        state.proposedAction ? `动议: ${state.proposedAction}` : "",
        state.deliberationReason ? `理由: ${state.deliberationReason}` : "",
        detail?.reason ? `票据理由: ${detail.reason}` : "",
    ].filter((line): line is string => line.length > 0);
    return lines.join("\n");
}

/** 根据单贤者票据构造肯定或否决徽标。 */
function buildDecisionBadge(
    state: SeelVoteRoundState,
    detail: SeelVoteDetailState,
) {
    const approved = detail.decision === "批准";
    const rejected = detail.decision === "否决";
    if (!approved && !rejected) {
        return null;
    }
    const badge: SeelVoteBadgeState = {
        token: state.token,
        roundId: state.roundId,
        label: approved ? "肯定" : "否决",
        tone: approved ? "approve" : "reject",
        tooltip: buildVoteBadgeTooltip(state, detail),
        ...(state.proposedAction ? { proposedAction: state.proposedAction } : {}),
        ...(state.deliberationReason ? { deliberationReason: state.deliberationReason } : {}),
        ...(detail.reason ? { reason: detail.reason } : {}),
    };
    return badge;
}

export function resolveSeelVoteBadgeState(
    messages: readonly MagiSeelPanelMessageView[],
    seelName: string,
): SeelVoteBadgeState | null {
    const state = collectLatestVoteRoundState(messages);
    if (!state) {
        return null;
    }

    const normalizedSeelName = normalizeSeelIdentity(seelName);
    if (!normalizedSeelName) {
        return null;
    }

    if (normalizeSeelIdentity(state.deliberationInitiator) === normalizedSeelName) {
        return {
            token: state.token,
            roundId: state.roundId,
            label: "动议",
            tone: "motion",
            tooltip: buildVoteBadgeTooltip(state),
            ...(state.proposedAction ? { proposedAction: state.proposedAction } : {}),
            ...(state.deliberationReason ? { deliberationReason: state.deliberationReason } : {}),
        };
    }

    const detail = state.details.get(normalizedSeelName);
    if (!detail) {
        return null;
    }
    return buildDecisionBadge(state, detail);
}

/** 初始化投票内容组件的响应式状态 */
export async function useVoteContentCtx(props: {
    meta: VoteMeta;
    timestamp: number;
}) {
    const decision = computed(() => props.meta.decision ?? getMagiI18nText("pending"));
    const round = computed(() => props.meta.round ?? 1);
    const conclusionClass = computed(() => ({
        "conclusion-pass": decision.value === "批准",
        "conclusion-reject": decision.value === "否决",
        "conclusion-pending": !props.meta.decision,
    }));
    const reasonText = computed(() => resolveVoteReason(props.meta));
    const hasReason = computed(() => reasonText.value.length > 0);
    const initialTime = await formatVoteTime(props.timestamp);
    const formattedTime = computed(() => initialTime);
    return {
        decision,
        round,
        conclusionClass,
        reasonText,
        hasReason,
        formattedTime,
    };
}
