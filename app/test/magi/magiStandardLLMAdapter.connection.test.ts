import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetAIConfigFromSiyuan = vi.hoisted(() => vi.fn());
const mockedGetActiveMagiArmorToken = vi.hoisted(() => vi.fn());
const mockedGetActiveMagiArmorSession = vi.hoisted(() => vi.fn());
const mockedDispatchCustomEvent = vi.hoisted(() => vi.fn());

vi.mock("../../src/magi/adapters/imports", () => ({
    getAIConfigFromSiyuan: mockedGetAIConfigFromSiyuan,
    getActiveMagiArmorToken: mockedGetActiveMagiArmorToken,
    getActiveMagiArmorSession: mockedGetActiveMagiArmorSession,
    getSiyuanConfig: vi.fn(),
    MAGI_IDENTITY_REQUIRED_EVENT: "magi-identity-required",
}));

vi.mock("../../src/magi/adapters/window.environment", () => ({
    dispatchCustomEvent: mockedDispatchCustomEvent,
}));

function createRequest(content: string) {
    return {
        model: "magi-trinity",
        messages: [{ role: "user", content }],
        stream: false,
    };
}

describe("magiStandardLLMAdapter backend connection status", () => {
    beforeEach(() => {
        mockedGetAIConfigFromSiyuan.mockReset();
        mockedGetActiveMagiArmorToken.mockReset();
        mockedGetActiveMagiArmorSession.mockReset();
        mockedDispatchCustomEvent.mockReset();
        mockedGetAIConfigFromSiyuan.mockReturnValue({
            apiBaseURL: "https://example.com/v1",
        });
        mockedGetActiveMagiArmorToken.mockReturnValue("magi_ak_v1_test-token");
        mockedGetActiveMagiArmorSession.mockReturnValue(null);
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should mark backend as connected after a successful backend response", async () => {
        const connectionStatus: { value: "disconnected" | "connected" | "error" } = { value: "disconnected" };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "chatcmpl-magi-backend-1",
                model: "magi-trinity",
                choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const { createMagiStandardLLMAdapter } = await import("../../src/magi/adapters/magiStandardLLMAdapter");

        const adapter = await createMagiStandardLLMAdapter({
            connectionStatus,
            consensusMessages: [],
            seels: [],
            mainInterfaceIdentity: {
                principalId: "workspace-admin",
                interfaceId: "main-1",
                interfaceKind: "magi-main-ui",
                interfaceLabel: "magi",
                conversationId: "main-conv-1",
            },
        });

        await adapter.createChatCompletion(createRequest("hello"));

        expect(connectionStatus.value).toBe("connected");
    });

    it("should mark backend as error after backend 5xx failure", async () => {
        const connectionStatus: { value: "disconnected" | "connected" | "error" } = { value: "connected" };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
        });
        vi.stubGlobal("fetch", fetchMock);
        const { createMagiStandardLLMAdapter } = await import("../../src/magi/adapters/magiStandardLLMAdapter");

        const adapter = await createMagiStandardLLMAdapter({
            connectionStatus,
            consensusMessages: [],
            seels: [],
            mainInterfaceIdentity: {
                principalId: "workspace-admin",
                interfaceId: "main-1",
                interfaceKind: "magi-main-ui",
                interfaceLabel: "magi",
                conversationId: "main-conv-1",
            },
        });

        await expect(adapter.createChatCompletion(createRequest("hello"))).rejects.toThrow("MAGI backend request failed");
        expect(connectionStatus.value).toBe("error");
    });
});
