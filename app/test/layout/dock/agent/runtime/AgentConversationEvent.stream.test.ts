import {afterEach, describe, expect, it, vi} from "vitest";

import {subscribeAgentConversationEvents} from "../../../../../src/layout/dock/agent/request/control/AgentConversationEvent.stream";

const encoder = new TextEncoder();

function closedStream(bytes: Uint8Array, splitAt: number[]) {
    let start = 0;
    const chunks = [...splitAt, bytes.length].map((end) => {
        const chunk = bytes.slice(start, end);
        start = end;
        return chunk;
    });
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(chunk);
            }
            controller.close();
        },
    });
}

function sseResponse(stream: ReadableStream<Uint8Array>) {
    return new Response(stream, {status: 200, headers: {"Content-Type": "text/event-stream; charset=utf-8"}});
}

describe("Agent conversation event stream", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("parses ordered SSE frames across arbitrary byte and line boundaries", async () => {
        const source = "id: 11\nevent: queue_state\ndata: {\"sessionID\":\"session+1\",\"timestamp\":101," +
            "\"queue\":{\"queueVersion\":2,\"items\":[]}}\n\n" +
            "id: 12\r\nevent: turn_phase\r\ndata: {\"sessionID\":\"session+1\",\"eventSeq\":12," +
            "\"timestamp\":102,\"turnID\":\"turn-1\",\"phase\":\"provider_stream\"}";
        const bytes = encoder.encode(source);
        const fetchMock = vi.fn(async () => sseResponse(closedStream(bytes, [3, 17, 54, 89, bytes.length - 7])));
        vi.stubGlobal("fetch", fetchMock);
        const onEvent = vi.fn();
        const requestHeaders = vi.fn(() => ({Authorization: "Bearer owner"}));
        const controller = new AbortController();

        await subscribeAgentConversationEvents({
            sessionID: "session+1", after: 10, signal: controller.signal, requestHeaders, onEvent,
        });

        expect(fetchMock).toHaveBeenCalledWith("/api/ai/agent/events?sessionID=session%2B1&after=10", {
            method: "GET",
            headers: {Authorization: "Bearer owner"},
            signal: controller.signal,
        });
        expect(requestHeaders).toHaveBeenCalledWith({scope: "app"});
        expect(onEvent.mock.calls.map(([event]) => [event.type, event.eventSeq])).toEqual([
            ["queue_state", 11],
            ["turn_phase", 12],
        ]);
        expect(onEvent.mock.calls[1]![0]).toMatchObject({turnID: "turn-1", phase: "provider_stream"});
    });

    it("delivers complete frames before surfacing an abrupt disconnect", async () => {
        let pullCount = 0;
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                pullCount++;
                if (pullCount === 1) {
                    controller.enqueue(encoder.encode(
                        "id: 1\nevent: session_state\ndata: {\"sessionID\":\"session-1\",\"timestamp\":1}\n\n",
                    ));
                    return;
                }
                controller.error(new Error("connection lost"));
            },
        });
        vi.stubGlobal("fetch", vi.fn(async () => sseResponse(stream)));
        const onEvent = vi.fn();

        await expect(subscribeAgentConversationEvents({
            sessionID: "session-1", after: 0, signal: new AbortController().signal,
            requestHeaders: () => ({}), onEvent,
        })).rejects.toThrow("connection lost");
        expect(onEvent).toHaveBeenCalledOnce();
        expect(onEvent.mock.calls[0]![0]).toMatchObject({type: "session_state", eventSeq: 1});
    });

    it("propagates AbortSignal cancellation to the pending fetch", async () => {
        const fetchMock = vi.fn((_path: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {once: true});
        }));
        vi.stubGlobal("fetch", fetchMock);
        const controller = new AbortController();
        const pending = subscribeAgentConversationEvents({
            sessionID: "session-1", after: 0, signal: controller.signal,
            requestHeaders: () => ({}), onEvent: vi.fn(),
        });

        controller.abort();
        await expect(pending).rejects.toMatchObject({name: "AbortError"});
        expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
    });

    it("rejects successful responses that are not SSE streams", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
            status: 200, headers: {"Content-Type": "application/json"},
        })));

        await expect(subscribeAgentConversationEvents({
            sessionID: "session-1", after: 0, signal: new AbortController().signal,
            requestHeaders: () => ({}), onEvent: vi.fn(),
        })).rejects.toThrow("not an SSE stream");
    });
});
