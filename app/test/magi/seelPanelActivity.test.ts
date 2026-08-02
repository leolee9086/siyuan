import { describe, expect, it } from "vitest";
import {
    buildSeelVirtualItems,
    formatToolCallArgs,
    getToolOutput,
    resolveLatestActivityToken,
} from "../../src/magi/components/seel-panel/SeelPanelActivity.ctx";
import type { MagiSeelPanelMessageView } from "../../src/magi/entry/magiView.types";

function createMessage(
    id: string,
    timestamp: number,
    overrides: Partial<MagiSeelPanelMessageView> = {},
): MagiSeelPanelMessageView {
    return {
        id,
        type: "system",
        content: id,
        status: "success",
        timestamp,
        ...overrides,
    };
}

describe("SeelPanel activity presentation", () => {
    it("应从线性活动流排除原始监控事件和投票状态快照", () => {
        const messages = [
            createMessage("raw", 30, { type: "event", meta: { type: "raw-event" } }),
            createMessage("vote-state", 40, { meta: { type: "vote-state" } }),
            createMessage("reply", 10, { type: "ai", content: "可读回复" }),
            createMessage("tool", 20, { meta: { type: "tool-activity" } }),
        ];

        const items = buildSeelVirtualItems(messages, true, "MELCHIOR-01");

        expect(items.map((item) => item.virtualId)).toEqual([
            "reply",
            "tool",
            "MELCHIOR-01-loading",
        ]);
    });

    it("应忽略更晚的监控原子事件并识别同一回复的流式增长", () => {
        const firstReply = createMessage("reply", 10, {
            type: "ai",
            status: "streaming",
            content: "第一段",
        });
        const rawEvent = createMessage("raw", 99, {
            type: "event",
            meta: { type: "raw-event" },
        });
        const firstToken = resolveLatestActivityToken([firstReply, rawEvent]);
        const nextToken = resolveLatestActivityToken([
            { ...firstReply, content: "第一段和第二段" },
            rawEvent,
        ]);

        expect(firstToken).toContain("reply:streaming:ai");
        expect(nextToken).not.toBe(firstToken);
        expect(resolveLatestActivityToken([rawEvent])).toBe("");
    });

    it("应以结构化文本展示完整工具参数，并优先展示失败原因", () => {
        const meta = {
            argumentsComplete: true,
            arguments: { query: "前缀缓存" },
            rawArguments: "{}",
            phase: "failed",
            result: "{\"ok\":false}",
            error: "索引不可用",
        };

        expect(formatToolCallArgs(meta)).toBe('{\n  "query": "前缀缓存"\n}');
        expect(getToolOutput(meta)).toBe("索引不可用");
    });

    it("应保留全部历史思考消息供卡片持续上下滚动", () => {
        const messages = Array.from({ length: 600 }, (_, index) => createMessage(
            `thinking-${index}`,
            index,
            {
                type: "ai",
                content: `<think>第 ${index} 条思考</think>第 ${index} 条结论`,
            },
        ));

        const items = buildSeelVirtualItems(messages, false, "MELCHIOR-01");

        expect(items).toHaveLength(600);
        expect(items[0]?.virtualId).toBe("thinking-0");
        expect(items[599]?.virtualId).toBe("thinking-599");
    });
});
