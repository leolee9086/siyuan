import { describe, expect, it } from "vitest";
import type { MagiRuntimeStatus } from "../../composables/useMagi.types";
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";
import {
    buildTrinityMonitorFacts,
    buildTrinityMonitorStats,
    buildTrinityMonitorStream,
    extractLatestTrinitySynthesis,
} from "./TrinityMonitorPanel.ctx";

function createRawEventMessage(
    id: string,
    eventType: string,
    payload: Record<string, unknown>,
    timestamp: number,
    seq: number,
): MagiSeelPanelMessageView {
    return {
        id,
        type: "event",
        content: eventType,
        status: "success",
        timestamp,
        meta: {
            type: "raw-event",
            eventType,
            eventPayload: payload,
            eventId: id,
            roundId: "round-1",
            seq,
        },
    };
}

describe("TrinityMonitorPanel ctx", () => {
    it("builds monitor stream entries from raw backend events", () => {
        const messages: MagiSeelPanelMessageView[] = [
            createRawEventMessage(
                "event-tool",
                "TOOL_CALL_DETECTED",
                {
                    seelName: "MELCHIOR-01",
                    displayName: "MELCHIOR",
                    toolName: "deliberation_signal",
                    argumentsComplete: false,
                },
                1711111111111,
                12,
            ),
        ];

        const items = buildTrinityMonitorStream(messages);

        expect(items).toHaveLength(1);
        expect(items[0]?.eventType).toBe("TOOL_CALL_DETECTED");
        expect(items[0]?.summary).toContain("deliberation_signal");
        expect(items[0]?.seqText).toBe("#12");
        expect(items[0]?.sourceLabel).toBe("MELCHIOR");
    });

    it("keeps latest synthesis separate from runtime monitor events", () => {
        const runtimeStatus: MagiRuntimeStatus = {
            state: "heartbeat",
            awake: true,
            currentRoundId: "round-1",
            currentTask: "Synthesizing",
            updatedAt: 1711111112222,
        };
        const messages: MagiSeelPanelMessageView[] = [
            createRawEventMessage(
                "event-runtime",
                "RUNTIME_STATUS_UPDATED",
                {
                    state: "heartbeat",
                    currentTask: "Synthesizing",
                },
                1711111111111,
                10,
            ),
            {
                id: "synthesis-1",
                type: "assistant",
                content: "Integrated response ready.",
                status: "success",
                timestamp: 1711111113333,
            },
        ];

        const synthesis = extractLatestTrinitySynthesis(messages);
        const stats = buildTrinityMonitorStats(messages, "connected", runtimeStatus);
        const facts = buildTrinityMonitorFacts(runtimeStatus);

        expect(synthesis?.content).toBe("Integrated response ready.");
        expect(stats.find((item) => item.label === "STATE")?.value).toBe("HEARTBEAT");
        expect(stats.find((item) => item.label === "ROUND")?.value).toBe("round-1");
        expect(facts.find((item) => item.label === "TASK")?.value).toBe("Synthesizing");
    });
});
