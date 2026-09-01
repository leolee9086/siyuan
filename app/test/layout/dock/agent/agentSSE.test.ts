import {describe, expect, it, vi} from "vitest";

vi.mock("../../../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

import {isAgentSSEProtocolError} from "../../../../src/layout/dock/agent/request/sse/agentSSE.error.guard";
import {parseAgentSSEEvent} from "../../../../src/layout/dock/agent/request/sse/agentSSE.parser.guard";

describe("Agent SSE protocol parsing", () => {
    it("preserves call identity, progress and confirmation effects", () => {
        expect(parseAgentSSEEvent("tool_call", JSON.stringify({
            name: "read_file",
            callID: "call-1",
            arguments: {path: "README.md"},
        }))).toEqual({
            type: "tool_call",
            name: "read_file",
            callID: "call-1",
            arguments: {path: "README.md"},
        });

        expect(parseAgentSSEEvent("confirm", JSON.stringify({
            name: "write_file",
            confirmID: "confirm-1",
            arguments: {path: "README.md"},
            effects: {localWrite: true, dataEgress: false},
        }))).toEqual({
            type: "confirm",
            name: "write_file",
            confirmID: "confirm-1",
            arguments: {path: "README.md"},
            effects: {localWrite: true, dataEgress: false},
        });

        expect(parseAgentSSEEvent("confirm_resolved", JSON.stringify({
            confirmID: "confirm-1",
            callID: "call-1",
            status: "expired",
            message: "agent confirmation expired",
        }))).toEqual({
            type: "confirm_resolved",
            confirmID: "confirm-1",
            callID: "call-1",
            status: "expired",
            message: "agent confirmation expired",
        });

        expect(parseAgentSSEEvent("question_resolved", JSON.stringify({
            questionID: "question-1",
            callID: "call-2",
            status: "submitted",
            answers: ["yes"],
        }))).toEqual({
            type: "question_resolved",
            questionID: "question-1",
            callID: "call-2",
            status: "submitted",
            message: "",
            answers: ["yes"],
        });

        expect(parseAgentSSEEvent("confirm_resolved", JSON.stringify({
            confirmID: "confirm-future",
            callID: "call-future",
            status: "future_status",
        }))).toMatchObject({status: "error"});
    });

    it("preserves browser capability, permission and round metadata", () => {
        expect(parseAgentSSEEvent("browser_capability_call", JSON.stringify({
            callID: "call-browser",
            name: "open_document",
            capabilityID: "native/open_document",
            generation: 3,
            arguments: {id: "doc-1"},
        }))).toEqual({
            type: "browser_capability_call",
            callID: "call-browser",
            name: "open_document",
            capabilityID: "native/open_document",
            generation: 3,
            arguments: {id: "doc-1"},
        });
        expect(parseAgentSSEEvent("thinking", JSON.stringify({
            reasoning: "processing", roundID: "round-1",
        }))).toEqual({type: "thinking", reasoning: "processing", roundID: "round-1"});
        expect(parseAgentSSEEvent("snapshot", JSON.stringify({
            snapshotID: "snapshot-1", roundID: "round-1",
        }))).toEqual({type: "snapshot", snapshotID: "snapshot-1", roundID: "round-1"});
        expect(parseAgentSSEEvent("permission", JSON.stringify({permissionMode: "allowSession"})))
            .toEqual({type: "permission", permissionMode: "allowSession"});
    });

    it("rejects malformed payloads instead of dropping the frame", () => {
        let thrown: unknown;
        try {
            parseAgentSSEEvent("content", "{invalid");
        } catch (error) {
            thrown = error;
        }
        expect(isAgentSSEProtocolError(thrown)).toBe(true);
    });

    it("rejects unknown events instead of silently ignoring them", () => {
        expect(() => parseAgentSSEEvent("future_event", "{}"))
            .toThrow('Unsupported Agent SSE event "future_event"');
    });
});
