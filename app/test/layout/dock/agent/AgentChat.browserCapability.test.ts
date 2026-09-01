import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    requestAgentInteraction: vi.fn(),
    lookupCapability: vi.fn(),
    isCapabilityEnabled: vi.fn(),
}));

vi.mock("../../../../src/layout/dock/agent/chat/interaction/confirm/imports", () => ({
    requestAgentInteraction: mocks.requestAgentInteraction,
}));
vi.mock("../../../../src/layout/dock/agent/frontendCapabilities", () => ({
    lookupCapability: mocks.lookupCapability,
    isCapabilityEnabled: mocks.isCapabilityEnabled,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {handleBrowserCapabilityCall} from
    "../../../../src/layout/dock/agent/chat/interaction/confirm/AgentChat.confirm.methods";

const createRuntime = () => ({
    app: {},
    sessionId: "session-1",
    sessionPorts: {
        requestHeaders: vi.fn(),
    },
}) as unknown as AgentChatRuntime;

describe("Agent browser capability execution", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isCapabilityEnabled.mockReturnValue(true);
        mocks.requestAgentInteraction.mockResolvedValue({state: "accepted"});
    });

    it("executes the generation-matched handler and returns structured output", async () => {
        const handler = vi.fn().mockResolvedValue({
            result: "opened",
            structuredContent: {documentID: "doc-1"},
        });
        mocks.lookupCapability.mockReturnValue({handler});
        const runtime = createRuntime();

        await handleBrowserCapabilityCall(
            runtime,
            "call-1",
            "native/open_document",
            4,
            {id: "doc-1"},
        );

        expect(mocks.lookupCapability).toHaveBeenCalledWith("native/open_document", 4);
        expect(handler).toHaveBeenCalledWith({id: "doc-1"}, runtime.app);
        expect(mocks.requestAgentInteraction).toHaveBeenCalledWith({
            path: "/api/ai/agent/browserCapabilityResult",
            body: {
                sessionID: "session-1",
                callID: "call-1",
                result: "opened",
                structuredContent: {documentID: "doc-1"},
                structuredContentSet: true,
                isError: false,
            },
            requestHeaders: runtime.sessionPorts.requestHeaders,
        });
    });

    it("reports unavailable capabilities without executing a handler", async () => {
        mocks.lookupCapability.mockReturnValue(undefined);
        const runtime = createRuntime();

        await handleBrowserCapabilityCall(runtime, "call-2", "plugin/missing", 1, {});

        expect(mocks.requestAgentInteraction).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.objectContaining({
                sessionID: "session-1",
                callID: "call-2",
                isError: true,
                structuredContentSet: false,
            }),
        }));
    });

    it("retries only transport-ambiguous result submissions", async () => {
        mocks.lookupCapability.mockReturnValue({handler: vi.fn().mockResolvedValue({result: "ok"})});
        mocks.requestAgentInteraction
            .mockResolvedValueOnce({state: "retryable", message: "offline"})
            .mockResolvedValueOnce({state: "retryable", message: "offline"})
            .mockResolvedValueOnce({state: "accepted"});

        await handleBrowserCapabilityCall(createRuntime(), "call-3", "native/open_document", 2, {});

        expect(mocks.requestAgentInteraction).toHaveBeenCalledTimes(3);
    });
});
