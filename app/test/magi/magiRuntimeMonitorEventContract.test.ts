import {describe, expect, it} from "vitest";

import {isValidMagiEventPayload} from "../../src/magi/events/dispatchMagiWebSocketMessage.guard";

describe("MAGI runtime monitor event contract", () => {
    it("accepts an LLM request summary without the full prompt messages", () => {
        expect(isValidMagiEventPayload("LLM_REQUEST_SENT", {
            eventId: "event-1",
            seq: 1,
            roundId: "round-1",
            timestamp: 1,
            seelName: "melchior",
            displayName: "Melchior",
            model: "model-1",
            messageCount: 12,
            promptBytes: 8192,
            toolCount: 3,
        })).toBe(true);
    });
});
