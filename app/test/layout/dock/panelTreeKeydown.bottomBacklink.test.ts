import {beforeEach, describe, expect, it, vi} from "vitest";
import {panelTreeKeydown} from "../../../src/boot/globalEvent/keydown/panelTreeKeydown";

const mocks = vi.hoisted(() => ({
    bottomPanelElement: null as HTMLElement | null,
}));

vi.mock("../../../src/boot/globalEvent/keydown/imports", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../src/boot/globalEvent/keydown/imports")>();
    return {
        ...actual,
        getAllModels: () => ({
            backlink: mocks.bottomPanelElement
                ? [{type: "bottom", element: mocks.bottomPanelElement}]
                : [],
        }),
    };
});

describe("panelTreeKeydown bottom backlink hotkey ownership", () => {
    beforeEach(() => {
        mocks.bottomPanelElement = null;
        window.siyuan = {
            config: {
                keymap: {
                    editor: {
                        general: {
                            collapse: {custom: "Ctrl+Shift+T"},
                            expand: {custom: "Ctrl+Shift+Y"},
                        },
                    },
                },
            },
        } as unknown as typeof window.siyuan;
        document.body.innerHTML = "";
    });

    it("returns false for collapse hotkey inside the bottom backlink panel", () => {
        const panel = document.createElement("div");
        panel.className = "sy__backlink--bottom";
        document.body.appendChild(panel);
        mocks.bottomPanelElement = panel;
        const target = document.createElement("div");
        panel.appendChild(target);
        const event = new KeyboardEvent("keydown", {key: "T", ctrlKey: true, shiftKey: true, bubbles: true});
        expect(panelTreeKeydown({} as never, event)).toBe(false);
    });

    it("returns false for expand hotkey inside the bottom backlink panel", () => {
        const panel = document.createElement("div");
        panel.className = "sy__backlink--bottom";
        document.body.appendChild(panel);
        mocks.bottomPanelElement = panel;
        const target = document.createElement("div");
        panel.appendChild(target);
        const event = new KeyboardEvent("keydown", {key: "Y", ctrlKey: true, shiftKey: true, bubbles: true});
        expect(panelTreeKeydown({} as never, event)).toBe(false);
    });

    it("does not take the bottom backlink early return when no bottom panel is involved", () => {
        const target = document.createElement("div");
        document.body.appendChild(target);
        // 无底部面板时匹配折叠/展开热键不触发早退；事件不匹配其它分支时应返回 false。
        const event = new KeyboardEvent("keydown", {key: "T", ctrlKey: true, shiftKey: true, bubbles: true});
        expect(panelTreeKeydown({} as never, event)).toBe(false);
    });
});
