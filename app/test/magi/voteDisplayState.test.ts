import { describe, expect, it } from "vitest";
import type { MagiSeelPanelMessageView } from "../../src/magi/entry/magiView.types";
import { resolveSeelVoteBadgeState } from "../../src/magi/components/seel-panel/SeelPanelVoteContent.ctx";
import { extractLatestVoteSummary } from "../../src/magi/components/trinity-monitor-panel/TrinityMonitorPanel.vote";

function createVoteEventMessage(
    id: string,
    timestamp: number,
    seq: number,
    payload: Record<string, unknown>,
): MagiSeelPanelMessageView {
    return {
        id,
        type: "event",
        content: "SEEL_VOTE_UPDATED",
        status: "success",
        timestamp,
        meta: {
            type: "raw-event",
            eventType: "SEEL_VOTE_UPDATED",
            eventPayload: payload,
            eventId: id,
            seq,
            roundId: "round-vote-1",
        },
    };
}

function createVoteStateMessage(payload: Record<string, unknown>): MagiSeelPanelMessageView {
    return {
        id: "round-vote-1-vote-state",
        type: "system",
        content: "投票状态已更新",
        status: "success",
        timestamp: 2_000,
        meta: {
            type: "vote-state",
            eventId: "vote-state-1",
            seq: 2,
            roundId: "round-vote-1",
            ...payload,
        },
    };
}

describe("vote display state", () => {
    it("应为三贤人解析动议 / 肯定 / 否决徽标", () => {
        const messages: MagiSeelPanelMessageView[] = [
            createVoteStateMessage({
                progress: 100,
                passed: true,
                round: 1,
                proposedAction: "记录当前推进到工作日志",
                deliberationInitiator: "MELCHIOR-01",
                deliberationReason: "需要留下可追踪记录",
                details: [
                    { name: "Melchior", decision: "批准", reason: "发起当前行动" },
                    { name: "Balthazar", decision: "批准", reason: "风险可控" },
                    { name: "Casper", decision: "否决", reason: "收益不够稳定" },
                ],
            }),
        ];

        expect(resolveSeelVoteBadgeState(messages, "MELCHIOR-01")).toMatchObject({
            label: "动议",
            tone: "motion",
        });
        expect(resolveSeelVoteBadgeState(messages, "BALTHASAR-02")).toMatchObject({
            label: "肯定",
            tone: "approve",
        });
        expect(resolveSeelVoteBadgeState(messages, "CASPER-03")).toMatchObject({
            label: "否决",
            tone: "reject",
        });
    });

    it("应为中央监控面板提取投票状态、动议和理由", () => {
        const summary = extractLatestVoteSummary([
            createVoteEventMessage("vote-start-2", 3_000, 3, {
                progress: 0,
                round: 2,
                proposedAction: "写入行动日志",
                deliberationInitiator: "MELCHIOR-01",
                deliberationReason: "需要沉淀执行依据",
            }),
            createVoteEventMessage("vote-progress-2", 4_000, 4, {
                progress: 50,
                round: 2,
                seelName: "BALTHASAR-02",
                displayName: "BALTHASAR",
                decision: "批准",
                decisionReason: "证据充分",
            }),
            createVoteEventMessage("vote-result-2", 5_000, 5, {
                progress: 100,
                round: 2,
                passed: false,
                proposedAction: "写入行动日志",
                deliberationInitiator: "MELCHIOR-01",
                deliberationReason: "需要沉淀执行依据",
                details: [
                    { name: "Melchior", decision: "批准", reason: "发起当前行动" },
                    { name: "Balthazar", decision: "批准", reason: "证据充分" },
                    { name: "Casper", decision: "否决", reason: "风险仍偏高" },
                ],
            }),
        ]);

        expect(summary).toMatchObject({
            statusLabel: "未通过",
            proposedAction: "写入行动日志",
            deliberationInitiator: "MELCHIOR-01",
            deliberationReason: "需要沉淀执行依据",
            progress: 100,
        });
        expect(summary?.details).toMatchObject([
            { name: "Melchior", decision: "批准", reason: "发起当前行动" },
            { name: "Balthazar", decision: "批准", reason: "证据充分" },
            { name: "Casper", decision: "否决", reason: "风险仍偏高" },
        ]);
    });
});
