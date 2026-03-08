import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMagiStandardLLMAdapter } from "./magiStandardLLMAdapter";
import { createRawOpenAIStandardLLMAdapter } from "./rawOpenAIStandardLLMAdapter";
import type { ChatRequestParams } from "../../ai/types";
import type { WrappedSeel } from "../composables/useMagi.types";

const mockedSendUserMessageWithConsensus = vi.hoisted(() => vi.fn());
const mockedAppendConsensusMessage = vi.hoisted(() => vi.fn());
const mockedGetAIConfigFromSiyuan = vi.hoisted(() => vi.fn());
const mockedUniversalStreamRequest = vi.hoisted(() => vi.fn());

vi.mock("../composables/useMagi.consensus", () => ({
    sendUserMessageWithConsensus: mockedSendUserMessageWithConsensus,
    appendConsensusMessage: mockedAppendConsensusMessage,
}));

vi.mock("../../ai/utils.config", () => ({
    getAIConfigFromSiyuan: mockedGetAIConfigFromSiyuan,
}));

vi.mock("../../util/network/fetchStream", () => ({
    universalStreamRequest: mockedUniversalStreamRequest,
}));

function createSeel(name: string): WrappedSeel {
    return {
        _originalAI: {
            config: {
                name,
                displayName: name,
                color: "#fff",
                icon: "icon",
                responseType: "sse",
                persona: "",
                memorySize: 7,
                openAIConfig: {},
            },
            messages: [],
            loading: false,
            connected: true,
            reply: async () => "",
            voteFor: async () => null,
            appendContextMessages: () => {},
            replaceLatestAssistantContextMessage: () => {},
        } as any,
        config: {
            name,
            displayName: name,
            color: "#fff",
            icon: "icon",
            responseType: "sse",
            persona: "",
            memorySize: 7,
        },
        messages: [],
        loading: false,
        connected: true,
        reply: async () => "",
        voteFor: async () => null,
        appendContextMessages: async () => {},
        replaceLatestAssistantContextMessage: async () => {},
    };
}

function createRequest(
    content: string,
    options?: { sourceSimulation?: boolean },
): ChatRequestParams {
    const messages: ChatRequestParams["messages"] = [];
    if (options?.sourceSimulation) {
        const sourcePayload = JSON.stringify({
            requestId: "req-contract-1",
            callerId: "contract-test",
            source: "guardian",
            trustBase: "high",
            riskLevel: "low",
            profileId: "profile-contract",
            profileLabel: "Contract Test",
            sourceChannel: "guardian",
        });
        messages.push({
            role: "system",
            content: `<magi_request_source>${sourcePayload}</magi_request_source>`,
        });
    }
    messages.push({ role: "user", content });
    return {
        model: "test-model",
        messages,
        stream: false,
    };
}

describe("standard-llm-adapter contract", () => {
    beforeEach(() => {
        mockedSendUserMessageWithConsensus.mockReset();
        mockedAppendConsensusMessage.mockReset();
        mockedGetAIConfigFromSiyuan.mockReset();
        mockedUniversalStreamRequest.mockReset();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("magi adapter should return OpenAI-compatible sync response", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-source-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: "chatcmpl-magi-backend-1",
                    model: "test-model",
                    choices: [{ message: { role: "assistant", content: "magi-final" }, finish_reason: "stop" }],
                }),
            }),
        );

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("MELCHIOR-01")],
        });

        const response = await adapter.createChatCompletion(
            createRequest("hello", { sourceSimulation: true }),
        );
        expect(response.model).toBe("test-model");
        expect(response.choices?.[0]?.message?.role).toBe("assistant");
        expect(response.choices?.[0]?.message?.content).toBe("magi-final");
        expect(response.choices?.[0]?.finish_reason).toBe("stop");
        expect(mockedSendUserMessageWithConsensus).not.toHaveBeenCalled();
    });

    it("magi adapter should emit stream callbacks with content and finish chunk", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-source-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: "chatcmpl-magi-backend-2",
                    model: "magi-trinity",
                    choices: [{ message: { role: "assistant", content: "stream-final" }, finish_reason: "stop" }],
                }),
            }),
        );

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("CASPER-03")],
        });

        const chunks: Array<string | undefined> = [];
        await adapter.streamChatCompletion(createRequest("streaming", { sourceSimulation: true }), {
            onChunk(chunk) {
                chunks.push(chunk.choices?.[0]?.delta?.content);
            },
        });

        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toBe("stream-final");
        expect(chunks[1]).toBeUndefined();
        expect(mockedSendUserMessageWithConsensus).not.toHaveBeenCalled();
    });

    it("magi adapter should forward non-source request with main-ui identity", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-source-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });
        vi.stubGlobal("window", {
            siyuan: {
                config: {
                    api: {
                        token: "workspace-token",
                    },
                },
                magi: {
                    target: "magi-desktop",
                },
            },
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "chatcmpl-magi-main",
                model: "test-model",
                choices: [{ message: { role: "assistant", content: "main-final" }, finish_reason: "stop" }],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("MELCHIOR-01")],
        });

        const response = await adapter.createChatCompletion(createRequest("hello main"));
        expect(response.choices?.[0]?.message?.content).toBe("main-final");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const call = fetchMock.mock.calls[0] as [string, RequestInit];
        const requestInit = call[1];
        const headers = requestInit.headers as Record<string, string>;
        expect(headers["X-MAGI-Source-Key"]).toBe("workspace-token");
        expect(headers["X-MAGI-Interface-Kind"]).toBe("magi-main-ui");
        const requestBody = JSON.parse(String(requestInit.body ?? "{}")) as { user?: string };
        expect(String(requestBody.user ?? "")).toContain("\"kind\":\"magi-main-ui\"");
        expect(mockedSendUserMessageWithConsensus).not.toHaveBeenCalled();
    });

    it("magi adapter should fail-fast when source simulation backend fails", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-source-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
            }),
        );

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("CASPER-03")],
        });

        await expect(
            adapter.createChatCompletion(createRequest("source failed", { sourceSimulation: true })),
        ).rejects.toThrow("MAGI backend request failed");
        expect(mockedSendUserMessageWithConsensus).not.toHaveBeenCalled();
    });

    it("raw-openai adapter should return OpenAI-compatible sync response", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: "chatcmpl-raw",
                    model: "gpt-test",
                    choices: [{ message: { role: "assistant", content: "raw-final" }, finish_reason: "stop" }],
                }),
            }),
        );

        const adapter = await createRawOpenAIStandardLLMAdapter();
        const response = await adapter.createChatCompletion(createRequest("hello raw"));
        expect(response.choices?.[0]?.message?.content).toBe("raw-final");
    });

    it("raw-openai adapter should map SSE message to onChunk and call onDone", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });

        mockedUniversalStreamRequest.mockImplementation(
            async (
                _request: unknown,
                callbacks: { onMessage: (content: string) => void; onDone: () => void },
            ) => {
                callbacks.onMessage(JSON.stringify({
                    id: "chunk-1",
                    object: "chat.completion.chunk",
                    choices: [{ delta: { content: "raw-stream" }, finish_reason: null }],
                }));
                callbacks.onDone();
            },
        );

        const adapter = await createRawOpenAIStandardLLMAdapter();
        const chunks: Array<string | undefined> = [];
        let done = false;
        await adapter.streamChatCompletion(createRequest("raw stream"), {
            onChunk(chunk) {
                chunks.push(chunk.choices?.[0]?.delta?.content);
            },
            onDone() {
                done = true;
            },
        });

        expect(chunks).toEqual(["raw-stream"]);
        expect(done).toBe(true);
    });
});
