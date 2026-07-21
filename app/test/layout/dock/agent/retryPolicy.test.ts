import {describe, expect, it} from "vitest";
import {canRetryLastUserTurn} from "../../../../src/layout/dock/agent/runtime/agentPanel.retryPolicy";

describe("canRetryLastUserTurn", () => {
    it("allows a plain assistant turn", () => {
        expect(canRetryLastUserTurn({
            entries: [{type: "user"}, {type: "assistant"}],
        })).toBe(true);
    });

    it("rejects a turn with a tool call", () => {
        expect(canRetryLastUserTurn({
            entries: [{type: "user"}, {type: "assistant", toolCalls: [{}]}],
        })).toBe(false);
    });

    it("rejects turns with side-effect events", () => {
        for (const type of ["confirm", "question", "snapshot", "rollback"]) {
            expect(canRetryLastUserTurn({
                entries: [{type: "user"}, {type}],
            })).toBe(false);
        }
    });

    it("only evaluates the latest user turn", () => {
        expect(canRetryLastUserTurn({
            entries: [{type: "user"}, {type: "assistant", toolCalls: [{}]}, {type: "user"}],
        })).toBe(true);
    });

    it("rejects active calls and pending confirmations", () => {
        expect(canRetryLastUserTurn({entries: [{type: "user"}], activeToolCallCount: 1})).toBe(false);
        expect(canRetryLastUserTurn({entries: [{type: "user"}], pendingConfirmationCount: 1})).toBe(false);
    });
});
