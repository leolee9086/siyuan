import {afterEach, describe, expect, it, vi} from "vitest";

import {requestAgentConversationControl} from "../../../../../src/layout/dock/agent/request/control/AgentConversationControl.request";

describe("Agent conversation control requests", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends JSON POST requests with dynamic owner headers and AbortSignal", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            code: 0, msg: "", data: {inputID: "input-1", queueVersion: 2},
        }), {status: 202, headers: {"Content-Type": "application/json"}}));
        vi.stubGlobal("fetch", fetchMock);
        const requestHeaders = vi.fn((options) => ({
            ...options.headers,
            Authorization: "Bearer owner",
        }));
        const controller = new AbortController();

        const result = await requestAgentConversationControl({
            path: "/api/ai/agent/queue",
            body: {inputID: "input-1"},
            requestHeaders,
            signal: controller.signal,
        });

        expect(result).toEqual({inputID: "input-1", queueVersion: 2});
        expect(requestHeaders).toHaveBeenCalledWith({
            scope: "app", headers: {"Content-Type": "application/json"},
        });
        expect(fetchMock).toHaveBeenCalledWith("/api/ai/agent/queue", {
            method: "POST",
            headers: {"Content-Type": "application/json", Authorization: "Bearer owner"},
            body: JSON.stringify({inputID: "input-1"}),
            signal: controller.signal,
        });
    });

    it("keeps GET requests bodyless and does not request a JSON content header", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            code: 0, data: {queueVersion: 0, items: []},
        }), {status: 200}));
        vi.stubGlobal("fetch", fetchMock);
        const requestHeaders = vi.fn(() => ({Authorization: "Bearer owner"}));

        await requestAgentConversationControl({
            path: "/api/ai/agent/queue?sessionID=session-1",
            method: "GET",
            requestHeaders,
        });

        expect(requestHeaders).toHaveBeenCalledWith({scope: "app"});
        expect(fetchMock).toHaveBeenCalledWith("/api/ai/agent/queue?sessionID=session-1", {
            method: "GET",
            headers: {Authorization: "Bearer owner"},
            signal: null,
        });
    });

    it("preserves structured conflict metadata for controller resynchronization", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            code: -1,
            msg: "queue version conflict",
            data: {reason: "queue_version_conflict", queueVersion: 9},
        }), {status: 409})));

        await expect(requestAgentConversationControl({
            path: "/api/ai/agent/queue/update",
            body: {inputID: "input-1"},
            requestHeaders: () => ({}),
        })).rejects.toMatchObject({
            message: "queue version conflict",
            reason: "queue_version_conflict",
            queueVersion: 9,
            status: 409,
        });
    });
});
