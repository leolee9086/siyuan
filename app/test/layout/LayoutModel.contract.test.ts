import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

import {Model} from "../../src/layout/Model";
import {createErrorPlaceholder} from "../../src/layout/dock/errorPlaceholder/ErrorPlaceholder";
import {isErrorPlaceholderData} from "../../src/layout/dock/errorPlaceholder/ErrorPlaceholder.guard";
import {isLayoutModel} from "../../src/layout/lifecycle/model.guard";
import {isLayoutSerializableModel} from "../../src/layout/lifecycle/model.guard";
import {applyLayoutModelSerialization} from "../../src/layout/lifecycle/model.serialization";
import {attachLayoutModel} from "../../src/layout/lifecycle/model.mount";

function escapeHTML(text: string) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function createDocumentStub() {
    return {
        createElement: vi.fn(() => {
            let text = "";
            return {
                set textContent(value: string) {
                    text = value;
                },
                get innerHTML() {
                    return escapeHTML(text);
                },
            };
        }),
    };
}

function createPanelStub() {
    return {
        classList: {add: vi.fn()},
        innerHTML: "",
    };
}

describe("layout model contract", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("recognizes the websocket Model by interface shape", () => {
        const model = new Model({app: {} as never});

        expect(isLayoutModel(model)).toBe(true);
    });

    it("creates a serializable error model without websocket capabilities", () => {
        vi.stubGlobal("document", createDocumentStub());
        const panel = createPanelStub();
        const model = createErrorPlaceholder({
            element: panel as unknown as HTMLElement,
            data: {
                原始类型: "broken-panel",
                错误信息: "<failed>",
            },
        });

        expect(isLayoutModel(model)).toBe(true);
        expect(isLayoutSerializableModel(model)).toBe(true);
        expect("ws" in model).toBe(false);
        expect("send" in model).toBe(false);
        expect("dispose" in model).toBe(false);
        expect(panel.classList.add).toHaveBeenCalledWith("fn__flex-column", "error-placeholder");
        expect(panel.innerHTML).toContain("&lt;failed&gt;");

        const json: Record<string, unknown> = {};
        expect(applyLayoutModelSerialization(model, json)).toBe(true);
        expect(json).toEqual({
            instance: "ErrorPlaceholder",
            errorPlaceholderType: "error_placeholder",
            errorPlaceholderData: {
                原始类型: "broken-panel",
                错误信息: "<failed>",
            },
        });
    });

    it("mounts interface models without requiring a concrete Tab", () => {
        const host = {parent: {element: {} as HTMLElement}};
        const model = {layoutModel: true as const};

        const attached = attachLayoutModel(host, model);
        expect(attached).toBe(model);
        expect(attached.parent).toBe(host);
    });

    it("accepts only complete error placeholder recovery data", () => {
        expect(isErrorPlaceholderData({原始类型: "dock", 错误信息: "failed"})).toBe(true);
        expect(isErrorPlaceholderData({原始类型: "dock"})).toBe(false);
        expect(isErrorPlaceholderData(null)).toBe(false);
    });

    it("rejects objects that merely resemble old Model instances", () => {
        expect(isLayoutModel({parent: {}})).toBe(false);
        expect(isLayoutModel({dispose: vi.fn()})).toBe(false);
    });
});
