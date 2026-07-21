import {describe, expect, it} from "vitest";
import {isActiveAgentPanelRequest} from "../../../../../src/layout/dock/agent/runtime/agentPanel.request.guard";

describe("Agent Panel request identity", () => {
    it("accepts only an active event for the same target and session", () => {
        const request = {kind: "native-agent" as const, sessionId: "session-1"};

        expect(isActiveAgentPanelRequest(request, request, false)).toBe(true);
        expect(isActiveAgentPanelRequest(
            {kind: "magi", sessionId: "session-1"},
            request,
            false,
        )).toBe(false);
        expect(isActiveAgentPanelRequest(
            {kind: "native-agent", sessionId: "session-2"},
            request,
            false,
        )).toBe(false);
        expect(isActiveAgentPanelRequest(request, request, true)).toBe(false);
    });
});
