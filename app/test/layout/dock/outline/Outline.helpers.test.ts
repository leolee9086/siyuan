import {describe, expect, it, vi} from "vitest";

vi.mock("../../../../src/layout/dock/outline/runtime/imports", () => ({
    fetchPost: vi.fn(),
    hasClosestBlock: vi.fn(),
    updateHotkeyAfterTip: (value: string) => value,
    Constants: {LOCAL_OUTLINE: "outline", ZWSP: "zwsp"},
    siyuanI18n: {},
    getSiyuanConfig: () => ({keymap: {editor: {general: {expand: {custom: ""}, collapse: {custom: ""}}}, general: {closeTab: {custom: ""}}}}),
    getSiyuanStorage: () => ({outline: {}}),
    getWindowSelection: vi.fn(),
}));

import {分发消息回调逻辑} from "../../../../src/layout/dock/outline/Outline.helpers";

function createOutline(type: "pin" | "local" = "local") {
    const removeTab = vi.fn();
    return {
        blockId: "doc-id",
        type,
        isPreview: false,
        element: document.createElement("div"),
        headerElement: document.createElement("div"),
        tree: {
            getExpandIds: () => [],
            setExpandIds: vi.fn(),
            expandAll: vi.fn(),
            collapseAll: vi.fn(),
        },
        preFilterExpandIds: null,
        parent: {id: "tab-id", parent: {removeTab}, updateTitle: vi.fn()},
        saveExpendIds: vi.fn(),
        collapseChildren: vi.fn(),
        collapseSameLevel: vi.fn(),
        setCurrent: vi.fn(),
        setCurrentByPreview: vi.fn(),
        setCurrentById: vi.fn(),
        setFilter: vi.fn(),
        showExpandLevelMenu: vi.fn(),
        showContextMenu: vi.fn(),
        minimize: vi.fn(),
        update: vi.fn(),
        updateDocTitle: vi.fn(),
        removeTab,
    };
}

/** 验证 Outline WebSocket 命令在无状态分派后保持原有副作用。 */
describe("Outline message dispatch", () => {
    it("updates the local tab title for a matching rename", () => {
        const outline = createOutline();

        分发消息回调逻辑(outline, {cmd: "rename", data: {id: "doc-id", title: "Renamed"}} as IWebSocketData);

        expect(outline.parent.updateTitle).toHaveBeenCalledWith("Renamed");
        expect(outline.updateDocTitle).not.toHaveBeenCalled();
    });

    it("updates the panel title for a pinned rename", () => {
        const outline = createOutline("pin");

        分发消息回调逻辑(outline, {cmd: "rename", data: {id: "doc-id", title: "Renamed"}} as IWebSocketData);

        expect(outline.updateDocTitle).toHaveBeenCalledWith({title: "Renamed", icon: "zwsp"}, -1);
    });

    it("closes only a matching local outline for removeDoc", () => {
        const outline = createOutline();

        分发消息回调逻辑(outline, {cmd: "removeDoc", data: {ids: ["doc-id"]}} as IWebSocketData);
        分发消息回调逻辑(outline, {cmd: "unknown", data: {}} as IWebSocketData);

        expect(outline.removeTab).toHaveBeenCalledWith("tab-id");
        expect(outline.removeTab).toHaveBeenCalledTimes(1);
    });
});
