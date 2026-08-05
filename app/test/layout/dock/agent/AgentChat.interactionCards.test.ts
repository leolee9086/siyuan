import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const saveSession = vi.hoisted(() => vi.fn(async () => null));

vi.mock("../../../../src/layout/dock/agent/chat/interaction/confirm/imports", async () => {
    const interaction = await vi.importActual<typeof import(
        "../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionRequest"
    )>("../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionRequest");
    const status = await vi.importActual<typeof import(
        "../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionStatus"
    )>("../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionStatus");
    return {
        escapeHtml: (value: string) => value,
        finishActiveThinking: vi.fn(),
        flushThinkingStep: vi.fn(),
        insertBeforeAI: vi.fn(),
        readPluginActionOutcome: vi.fn(),
        renderConfirmEffects: vi.fn(() => ""),
        requestAgentInteraction: interaction.requestAgentInteraction,
        resolveInteractionStatusLabel: status.resolveInteractionStatusLabel,
        saveSession,
        scrollToBottom: vi.fn(),
        toolCategory: vi.fn(() => "tool"),
    };
});

vi.mock("../../../../src/layout/dock/agent/chat/interaction/question/imports", async () => {
    const interaction = await vi.importActual<typeof import(
        "../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionRequest"
    )>("../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionRequest");
    const status = await vi.importActual<typeof import(
        "../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionStatus"
    )>("../../../../src/layout/dock/agent/chat/interaction/AgentChat.interactionStatus");
    return {
        requestAgentInteraction: interaction.requestAgentInteraction,
        resolveInteractionStatusLabel: status.resolveInteractionStatusLabel,
        saveSession,
    };
});

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {bindConfirmCardActions} from "../../../../src/layout/dock/agent/chat/interaction/confirm/AgentChat.confirm.helpers";
import {postConfirm} from "../../../../src/layout/dock/agent/chat/interaction/confirm/AgentChat.confirm.methods";
import {resolveConfirm} from "../../../../src/layout/dock/agent/chat/interaction/confirm/AgentChat.confirm.methods";
import {bindQuestionSubmit} from "../../../../src/layout/dock/agent/chat/interaction/question/AgentChat.question.helpers";
import {resolveQuestion} from "../../../../src/layout/dock/agent/chat/interaction/question/AgentChat.question.resolution";

function response(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
}

function createRuntime(entries: AgentChatRuntime["entries"]) {
    const messagesContainer = document.createElement("div");
    const showMessage = vi.fn();
    const runtime = {
        capabilities: {showMessage},
        entries,
        messagesContainer,
        pendingConfirms: [],
        sessionId: "session-1",
        sessionPorts: {requestHeaders: () => ({})},
    } as unknown as AgentChatRuntime;
    return {messagesContainer, runtime, showMessage};
}

function createConfirmHarness() {
    const entry = {id: "confirm-entry", type: "confirm" as const, name: "write_file", args: {},
        confirmID: "confirm-1", status: "pending"};
    const {messagesContainer, runtime, showMessage} = createRuntime([entry]);
    const card = document.createElement("div");
    card.setAttribute("data-confirm-id", "confirm-1");
    card.innerHTML = '<div class="agent-chat__confirm-actions">' +
        '<button class="agent-chat__confirm-reject">Reject</button>' +
        '<button class="agent-chat__confirm-approve">Approve</button>' +
        '<button class="agent-chat__confirm-always">Session Allow</button></div>';
    messagesContainer.append(card);
    bindConfirmCardActions(runtime, {
        el: card, confirmID: "confirm-1", sessionID: "session-1", confirmEntryID: "confirm-entry",
    }, (request) => postConfirm(runtime, request));
    return {approve: card.querySelector<HTMLButtonElement>(".agent-chat__confirm-approve")!, card, entry,
        runtime, showMessage};
}

function createQuestionHarness() {
    const entry = {id: "question-entry", type: "question" as const, questionID: "question-1",
        questions: [{question: "Continue?"}], status: "pending"};
    const {messagesContainer, runtime, showMessage} = createRuntime([entry]);
    const card = document.createElement("div");
    card.setAttribute("data-question-id", "question-1");
    card.innerHTML = '<div class="agent-chat__question-options" data-qi="0">' +
        '<input type="radio" value="yes" checked>' +
        '<input class="agent-chat__question-custom" data-qi="0" value="details"></div>' +
        '<div class="agent-chat__question-submit"><button class="agent-chat__question-submit-btn">Submit</button></div>';
    messagesContainer.append(card);
    bindQuestionSubmit(runtime, {el: card, questionID: "question-1", questionCount: 1,
        sessionID: "session-1", questionEntryID: "question-entry"});
    return {card, entry, fields: Array.from(card.querySelectorAll<HTMLInputElement>("input")), runtime,
        showMessage, submit: card.querySelector<HTMLButtonElement>(".agent-chat__question-submit-btn")!};
}

beforeEach(() => {
    document.body.innerHTML = "";
    saveSession.mockClear();
    Object.defineProperty(window, "siyuan", {configurable: true, value: {languages: {
        agentConfirmApprove: "Approved",
        agentConfirmAlways: "Session Allow",
        agentConfirmPending: "Pending",
        agentConfirmReject: "Rejected",
        agentConfirmTimeout: "Expired",
        agentQuestionPending: "Awaiting answer",
        agentQuestionSubmitted: "Submitted",
        agentQueueFailed: "Failed",
        cancel: "Cancelled",
    }}});
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("Agent confirmation card lifecycle", () => {
    it("settles a structured HTTP 409 as expired and removes every repeat action", async () => {
        const fetchMock = vi.fn(async () => response(409, {code: -1, msg: "confirmation expired",
            data: {reason: "interaction_expired", status: "expired", queueVersion: 0}}));
        vi.stubGlobal("fetch", fetchMock);
        const harness = createConfirmHarness();

        harness.approve.click();
        await vi.waitFor(() => expect(harness.entry.status).toBe("expired"));

        expect(harness.card.classList.contains("agent-chat__msg--confirmed")).toBe(true);
        expect(harness.card.querySelector(".agent-chat__confirm-done")?.textContent).toBe("Expired");
        expect(harness.card.querySelectorAll("button")).toHaveLength(0);
        expect(harness.showMessage).toHaveBeenCalledWith("confirmation expired", 3000);
        harness.approve.click();
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("restores actions and exposes the transport error after a network failure", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("connection reset"))));
        const harness = createConfirmHarness();

        harness.approve.click();
        await vi.waitFor(() => expect(harness.showMessage).toHaveBeenCalledWith("connection reset", 3000));

        expect(harness.approve.disabled).toBe(false);
        expect(harness.card.querySelectorAll<HTMLButtonElement>("button:disabled")).toHaveLength(0);
        expect(harness.card.classList.contains("agent-chat__msg--confirmed")).toBe(false);
        expect(harness.entry.status).toBe("pending");
    });

    it("keeps HTTP 200 pending until the explicit resolved projection arrives", async () => {
        const fetchMock = vi.fn(async () => response(200, {code: 0, msg: "", data: {accepted: true}}));
        vi.stubGlobal("fetch", fetchMock);
        const harness = createConfirmHarness();

        harness.approve.click();
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

        expect(harness.approve.disabled).toBe(true);
        expect(harness.entry.status).toBe("pending");
        expect(harness.card.classList.contains("agent-chat__msg--confirmed")).toBe(false);
        expect(saveSession).not.toHaveBeenCalled();

        resolveConfirm(harness.runtime, {confirmID: "confirm-1", status: "approved"});
        expect(harness.entry.status).toBe("approved");
        expect(harness.card.querySelector(".agent-chat__confirm-done")?.textContent).toBe("Approved");
    });
});

describe("Agent question card lifecycle", () => {
    it.each([
        {status: "expired", label: "Expired", message: "question expired"},
        {status: "error", label: "Failed", message: "question failed"},
    ] as const)("settles HTTP 409 status $status as a closed card", async ({status, label, message}) => {
        vi.stubGlobal("fetch", vi.fn(async () => response(409, {code: -1, msg: message,
            data: {reason: "interaction_expired", status, queueVersion: 0}})));
        const harness = createQuestionHarness();

        harness.submit.click();
        await vi.waitFor(() => expect(harness.entry.status).toBe(status));

        expect(harness.card.querySelector(".agent-chat__confirm-done")?.textContent).toBe(label);
        expect(harness.card.querySelectorAll("button")).toHaveLength(0);
        expect(harness.fields.every((field) => field.disabled)).toBe(true);
        expect(harness.showMessage).toHaveBeenCalledWith(message, 3000);
    });

    it("keeps accepted answers pending and projects submitted answers only from the resolved event", async () => {
        const fetchMock = vi.fn(async () => response(200, {code: 0, msg: "", data: {accepted: true}}));
        vi.stubGlobal("fetch", fetchMock);
        const harness = createQuestionHarness();

        harness.submit.click();
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
            sessionID: "session-1", questionID: "question-1", answers: ["yes", "details"],
        });
        expect(harness.entry.status).toBe("pending");
        expect(harness.submit.disabled).toBe(true);

        resolveQuestion(harness.runtime, {questionID: "question-1", status: "submitted",
            answers: ["yes", "details"]});
        expect(harness.entry).toMatchObject({status: "submitted", answers: ["yes", "details"]});
        expect(harness.card.querySelector(".agent-chat__confirm-done")?.textContent).toBe("Submitted");
    });
});
