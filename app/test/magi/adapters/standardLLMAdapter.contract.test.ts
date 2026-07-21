import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMagiStandardLLMAdapter } from "../../../src/magi/adapters/magiStandardLLMAdapter";
import type { ChatRequestParams } from "../../../src/ai/types";

const mockedGetAIConfigFromSiyuan = vi.hoisted(() => vi.fn());
const mockedGetActiveMagiArmorToken = vi.hoisted(() => vi.fn());
const mockedGetActiveMagiArmorSession = vi.hoisted(() => vi.fn());

vi.mock("../../../src/ai/utils/utils.config", () => ({
    getAIConfigFromSiyuan: mockedGetAIConfigFromSiyuan,
}));

vi.mock("../../../src/magi/service/magiIdentitySession", () => ({
    getActiveMagiArmorToken: mockedGetActiveMagiArmorToken,
    getActiveMagiArmorSession: mockedGetActiveMagiArmorSession,
}));

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
        mockedGetAIConfigFromSiyuan.mockReset();
        mockedGetActiveMagiArmorToken.mockReset();
        mockedGetActiveMagiArmorSession.mockReset();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        mockedGetActiveMagiArmorToken.mockReturnValue("magi_ak_v1_test-token");
        mockedGetActiveMagiArmorSession.mockReturnValue(null);
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
        });

        const response = await adapter.createChatCompletion(
            createRequest("hello", { sourceSimulation: true }),
        );
        expect(response.model).toBe("test-model");
        expect(response.choices?.[0]?.message?.role).toBe("assistant");
        expect(response.choices?.[0]?.message?.content).toBe("magi-final");
        expect(response.choices?.[0]?.finish_reason).toBe("stop");
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
    });

    it("magi adapter should forward the caller abort signal to the backend request", async () => {
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
            apiKey: "test-source-key",
            apiModel: "gpt-test",
            apiTimeout: 12000,
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "chatcmpl-magi-abort",
                model: "magi-trinity",
                choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const controller = new AbortController();
        const adapter = await createMagiStandardLLMAdapter({
            model: "magi-trinity",
            connectionStatus: { value: "connected" },
        });

        await adapter.streamChatCompletion(createRequest("abortable"), {}, controller.signal);

        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(requestInit.signal).toBe(controller.signal);
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
        });

        const response = await adapter.createChatCompletion(createRequest("hello main"));
        expect(response.choices?.[0]?.message?.content).toBe("main-final");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const call = fetchMock.mock.calls[0] as [string, RequestInit];
        const requestInit = call[1];
        const headers = requestInit.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer magi_ak_v1_test-token");
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
        });

        await expect(
            adapter.createChatCompletion(createRequest("source failed", { sourceSimulation: true })),
        ).rejects.toThrow("MAGI backend request failed");
    });
});
