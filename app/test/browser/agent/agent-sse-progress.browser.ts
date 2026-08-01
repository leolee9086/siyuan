import {beforeAll, describe, expect, it} from "vitest";
import {
    renderWebSearchProgress,
    renderWebSearchResult,
} from "../../../src/layout/dock/agent/chat/interaction/tools/websearch/renderer";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("native Agent live search SSE", () => {
    let fetchAgentSSE: typeof import("../../../src/layout/dock/agent/agentSSE").fetchAgentSSE;

    beforeAll(async () => {
        const globals = globalThis as unknown as Record<string, unknown>;
        globals.SIYUAN_VERSION = "test";
        globals.NODE_ENV = "test";
        ({fetchAgentSSE} = await import("../../../src/layout/dock/agent/agentSSE"));
    });

    it("renders intermediate progress before the final tool result arrives", async () => {
        const originalFetch = globalThis.fetch;
        const host = document.createElement("div");
        const observations: string[] = [];
        const events = [
            "event:tool_call\ndata:{\"name\":\"web_search\",\"callID\":\"call-1\",\"arguments\":{\"query\":\"sse test\"}}\n\n",
            "event:tool_progress\ndata:{\"name\":\"web_search\",\"callID\":\"call-1\",\"progress\":{\"phase\":\"result\",\"done\":1,\"total\":2,\"current\":\"github\",\"partialCount\":1,\"latestResults\":[{\"title\":\"First result\",\"url\":\"https://example.com/first\",\"engine\":\"github\"}]}}\n\n",
            "event:tool_progress\ndata:{\"name\":\"web_search\",\"callID\":\"call-1\",\"progress\":{\"phase\":\"done\",\"done\":2,\"total\":2,\"current\":\"bing\",\"partialCount\":2,\"latestResults\":[{\"title\":\"Second result\",\"url\":\"https://example.com/second\",\"engine\":\"bing\"}]}}\n\n",
            "event:tool_result\ndata:{\"name\":\"web_search\",\"callID\":\"call-1\",\"result\":\"{\\\"query\\\":\\\"sse test\\\",\\\"results\\\":[{\\\"title\\\":\\\"Final result\\\",\\\"url\\\":\\\"https://example.com/final\\\"}]}\"}\n\n",
            "event:done\ndata:{}\n\n",
        ];

        globalThis.fetch = (async () => {
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encode(events[0]));
                    let index = 1;
                    const push = () => {
                        if (index >= events.length) {
                            controller.close();
                            return;
                        }
                        controller.enqueue(encode(events[index++]));
                        setTimeout(push, 5);
                    };
                    setTimeout(push, 5);
                },
            });
            return new Response(stream, {
                status: 200,
                headers: {"Content-Type": "text/event-stream"},
            });
        }) as typeof fetch;

        try {
            await fetchAgentSSE({
                message: "sse test",
                language: "en_US",
                references: [],
                onEvent: (event) => {
                    if (event.type === "tool_progress") {
                        host.innerHTML = renderWebSearchProgress("sse test", event.progress);
                        observations.push(host.textContent || "");
                    } else if (event.type === "tool_result") {
                        host.innerHTML = renderWebSearchResult("sse test", event.result);
                    }
                },
                onError: (error) => { throw error; },
            });
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(observations).toHaveLength(2);
        expect(observations[0]).toContain("github");
        expect(observations[0]).toContain("1/2");
        expect(observations[0]).toContain("First result");
        expect(observations[1]).toContain("bing");
        expect(observations[1]).toContain("2/2");
        expect(host.textContent).toContain("Final result");
        expect(host.querySelector("a[href=\"https://example.com/final\"]")).not.toBeNull();
    });
});
