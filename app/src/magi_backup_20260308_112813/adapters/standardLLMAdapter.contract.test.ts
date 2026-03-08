import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMagiStandardLLMAdapter } from "./magiStandardLLMAdapter";
import { createRawOpenAIStandardLLMAdapter } from "./rawOpenAIStandardLLMAdapter";
import type { ChatRequestParams } from "../../ai/types";
import type { WrappedSeel } from "../composables/useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";

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

function createRequest(content: string): ChatRequestParams {
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
    return {
        model: "test-model",
        messages: [
            { role: "system", content: `<magi_request_source>${sourcePayload}</magi_request_source>` },
            { role: "user", content },
        ],
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
    });

    it("magi adapter should return OpenAI-compatible sync response", async () => {
        mockedSendUserMessageWithConsensus.mockImplementation(
            async (
                _userInput: string,
                _connectionStatus: { value: string },
                consensusMessages: MagiMessage[],
            ) => {
                consensusMessages.push({
                    id: "msg-1",
                    type: "consensus",
                    content: "magi-final",
                    status: "success",
                    timestamp: Date.now(),
                });
            },
        );

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("MELCHIOR-01")],
        });

        const response = await adapter.createChatCompletion(createRequest("hello"));
        expect(response.model).toBe("test-model");
        expect(response.choices?.[0]?.message?.role).toBe("assistant");
        expect(response.choices?.[0]?.message?.content).toBe("magi-final");
        expect(response.choices?.[0]?.finish_reason).toBe("stop");
    });

    it("magi adapter should emit stream callbacks with content and finish chunk", async () => {
        mockedSendUserMessageWithConsensus.mockImplementation(
            async (
                _userInput: string,
                _connectionStatus: { value: string },
                consensusMessages: MagiMessage[],
            ) => {
                consensusMessages.push({
                    id: "msg-stream",
                    type: "consensus",
                    content: "stream-final",
                    status: "success",
                    timestamp: Date.now(),
                });
            },
        );

        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
            consensusMessages: [],
            seels: [createSeel("CASPER-03")],
        });

        const chunks: Array<string | undefined> = [];
        await adapter.streamChatCompletion(createRequest("streaming"), {
            onChunk(chunk) {
                chunks.push(chunk.choices?.[0]?.delta?.content);
            },
        });

        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toBe("stream-final");
        expect(chunks[1]).toBeUndefined();
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
