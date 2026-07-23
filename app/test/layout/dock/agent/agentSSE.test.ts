import {describe, expect, it, vi} from "vitest";

vi.mock("../../../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

vi.mock("../../../../src/layout/dock/agent/SessionStore", () => ({
    agentOwnerHeaders: (headers: Record<string, string>) => headers,
}));

import {
    AgentSSEProtocolError,
    parseAgentSSEEvent,
} from "../../../../src/layout/dock/agent/agentSSE";

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
    });

    it("rejects malformed payloads instead of dropping the frame", () => {
        expect(() => parseAgentSSEEvent("content", "{invalid"))
            .toThrow(AgentSSEProtocolError);
    });

    it("rejects unknown events instead of silently ignoring them", () => {
        expect(() => parseAgentSSEEvent("future_event", "{}"))
            .toThrow('Unsupported Agent SSE event "future_event"');
    });
});
