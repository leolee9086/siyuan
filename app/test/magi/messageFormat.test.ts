import { describe, expect, it } from "vitest";
import {
    isStatusTransition,
    isStreamingMessage,
    isStreamingReplyActivity,
    validStatusTypes,
} from "../../src/magi/utils/messageFormat";

describe("MAGI message activity formatting", () => {
    it("应把真实 AI streaming 消息识别为聊天式流内容", async () => {
        const message = {
            type: "ai",
            status: "streaming",
            content: "<think>检查上下文</think>正在回复",
        };

        expect(validStatusTypes.has("streaming")).toBe(true);
        expect(isStreamingReplyActivity(message)).toBe(true);
        await expect(isStreamingMessage(message)).resolves.toBe(true);
    });

    it("应在 streaming 完成时触发最终内容重解析", async () => {
        await expect(isStatusTransition("success", "streaming", "最终回复")).resolves.toBe(true);
        await expect(isStatusTransition("streaming", "streaming", "增量回复")).resolves.toBe(false);
    });
});
