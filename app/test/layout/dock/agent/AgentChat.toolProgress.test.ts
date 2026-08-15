import {beforeEach, describe, expect, it, vi} from "vitest";

const insertBeforeAI = vi.hoisted(() => vi.fn());
const registerWebSearchReferences = vi.hoisted(() => vi.fn());
const renderTodoList = vi.hoisted(() => vi.fn(() => ""));
const renderToolsLineHTML = vi.hoisted(() => vi.fn(() => ""));
const scrollToBottom = vi.hoisted(() => vi.fn());
const renderToolCallProgress = vi.hoisted(() => vi.fn(() => '<div class="agent-chat__tool-call-progress">progress</div>'));
const renderToolCallResult = vi.hoisted(() => vi.fn(() => ""));
const renderToolCallStart = vi.hoisted(() => vi.fn(() => '<div class="agent-chat__tool-call-start">start</div>'));
const renderWebSearchProgress = vi.hoisted(() => vi.fn(() => '<div class="agent-chat__web-search-progress">search</div>'));
const renderWebSearchResult = vi.hoisted(() => vi.fn(() => ""));

vi.mock("../../../../src/layout/dock/agent/chat/interaction/tools/imports", () => ({
    insertBeforeAI,
    registerWebSearchReferences,
    renderTodoList,
    renderToolsLineHTML,
    scrollToBottom,
}));
vi.mock("../../../../src/layout/dock/agent/chat/interaction/tools/toolcall/renderer", () => ({
    renderToolCallProgress,
    renderToolCallResult,
    renderToolCallStart,
}));
vi.mock("../../../../src/layout/dock/agent/chat/interaction/tools/websearch/renderer", () => ({
    renderWebSearchProgress,
    renderWebSearchResult,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {ISSEResult} from "../../../../src/layout/dock/agent/request/sse/agentSSE.types";
import {applyToolCardEvent} from "../../../../src/layout/dock/agent/chat/interaction/tools/AgentChat.toolCards";

function createRuntime() {
    const messagesContainer = document.createElement("div");
    const runtime = {
        messagesContainer,
        currentToolCalls: [],
        hasInterveningCard: false,
    } as unknown as AgentChatRuntime;
    insertBeforeAI.mockImplementation((_runtime: AgentChatRuntime, element: HTMLElement) => {
        messagesContainer.appendChild(element);
    });
    return {messagesContainer, runtime};
}

function progressEvent(name: string, callID: string): Extract<ISSEResult, {type: "tool_progress"}> {
    return {type: "tool_progress", name, callID,
        progress: {phase: "update", done: 1, total: 2, current: "current-engine", partialCount: 1,
            latestResults: []}};
}

describe("AgentChat tool progress projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rebuilds a missing tool call record and card when only a progress event arrives", () => {
        const {messagesContainer, runtime} = createRuntime();

        applyToolCardEvent(runtime, progressEvent("web_search", "call-1"));

        // 事件流重放窗口截断或视图重载后没有 tool_call，进度事件必须自建卡片并登记调用记录。
        expect(runtime.currentToolCalls).toHaveLength(1);
        expect(runtime.currentToolCalls[0]).toMatchObject({id: "call-1", name: "web_search"});
        const card = messagesContainer.querySelector<HTMLElement>("[data-tool-call-id=\"call-1\"]");
        expect(card).not.toBeNull();
        expect(renderWebSearchProgress).toHaveBeenCalled();
    });

    it("rebuilds a generic tool card and record for a missing progress event", () => {
        const {messagesContainer, runtime} = createRuntime();

        applyToolCardEvent(runtime, progressEvent("file_read", "call-2"));

        expect(runtime.currentToolCalls).toHaveLength(1);
        expect(runtime.currentToolCalls[0]).toMatchObject({id: "call-2", name: "file_read"});
        expect(messagesContainer.querySelector<HTMLElement>("[data-tool-call-id=\"call-2\"]")).not.toBeNull();
        expect(renderToolCallProgress).toHaveBeenCalled();
    });

    it("updates the existing card without duplicating it", () => {
        const {messagesContainer, runtime} = createRuntime();
        applyToolCardEvent(runtime, progressEvent("web_search", "call-1"));
        applyToolCardEvent(runtime, progressEvent("web_search", "call-1"));

        expect(runtime.currentToolCalls).toHaveLength(1);
        expect(messagesContainer.querySelectorAll("[data-tool-call-id=\"call-1\"]")).toHaveLength(1);
        // 首次投影补建起始卡片渲染一次，两次更新各渲染一次。
        expect(renderWebSearchProgress).toHaveBeenCalledTimes(3);
    });
});
