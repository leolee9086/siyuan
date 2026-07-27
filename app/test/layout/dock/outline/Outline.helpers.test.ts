import {describe, expect, it, vi} from "vitest";
import type {Plugin} from "siyuan";
import {EventBus} from "../../../../src/plugin/EventBus";
import {createAppFacade} from "../../../../src/app/AppFacade.types";
import type {OutlineDomain} from "../../../../src/layout/dock/outline/types";
import {outlineModelBrand} from "../../../../src/layout/dock/outline/types";
import type {LayoutDomain, LayoutTab, LayoutWindow} from "../../../../src/layout/layout.types";

const editorContextRuntime = vi.hoisted(() => ({
    getAllModels: vi.fn(),
}));

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

vi.mock("../../../../src/layout/dock/outline/editorContext/imports", () => ({
    getAllModels: editorContextRuntime.getAllModels,
    isHTMLElement: (element: Element) => element instanceof HTMLElement,
}));

import {分发消息回调逻辑} from "../../../../src/layout/dock/outline/Outline.helpers";
import {getProtyleAndBlockElement} from "../../../../src/layout/dock/outline/editorContext/resolve";

function createOutline(type: "pin" | "local" = "local") {
    const removeTab = vi.fn();
    const layout: LayoutDomain = {
        element: document.createElement("div"),
        children: [],
        direction: "lr",
        addLayout: vi.fn(),
        addWnd: vi.fn(),
    };
    const wnd: LayoutWindow = {
        id: "wnd-id",
        parent: layout,
        element: document.createElement("div"),
        headersElement: document.createElement("div"),
        children: [],
        showHeading: vi.fn(),
        switchTab: vi.fn(),
        addTab: vi.fn(),
        removeTab,
        moveTab: vi.fn(),
        split: vi.fn(() => wnd),
        ensureCenterWindow: vi.fn(),
        remove: vi.fn(),
    };
    const tab: LayoutTab = {
        id: "tab-id",
        parent: wnd,
        headElement: document.createElement("div"),
        panelElement: document.createElement("div"),
        callback: vi.fn(),
        model: {layoutModel: true},
        title: "",
        icon: "",
        docIcon: "",
        updateTitle: vi.fn(),
        addModel: vi.fn(),
        initialize: vi.fn(),
        pin: vi.fn(),
        setDocIcon: vi.fn(),
        unpin: vi.fn(),
        close: vi.fn(),
    };
    const app = createAppFacade<Plugin, EventBus>({
        plugins: [],
        appId: "outline-test",
        eventBus: new EventBus("outline-test"),
        pluginHost: {reloadData: vi.fn(), addDock: vi.fn()},
        createProtyle: vi.fn(),
        openTab: vi.fn(),
        openAsset: vi.fn(),
        openBlock: vi.fn(),
        openDatabaseRow: vi.fn(),
        processSiYuanUri: vi.fn(() => false),
    });
    const outline: OutlineDomain = {
        [outlineModelBrand]: "Outline",
        layoutModel: true,
        ws: Object.create(WebSocket.prototype),
        reqId: 0,
        app,
        parent: tab,
        blockId: "doc-id",
        type,
        isPreview: false,
        element: document.createElement("div"),
        headerElement: document.createElement("div"),
        tree: {
            element: document.createElement("div"),
            click: vi.fn(),
            updateData: vi.fn(),
            toggleBlocks: vi.fn(),
            getExpandIds: () => [],
            setExpandIds: vi.fn(),
            expandAll: vi.fn(),
            collapseAll: vi.fn(),
        },
        preFilterExpandIds: null,
        connect: vi.fn(),
        send: vi.fn(),
        dispose: vi.fn(),
        bindSort: vi.fn(),
        expandToLevel: vi.fn(),
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
        genHeadingTransform: vi.fn(),
        getProtyleAndBlockElement: vi.fn(),
        initHeaderEvents: vi.fn(),
        onModelCallback: vi.fn(),
        onModelMsgCallback: vi.fn(),
        reload: vi.fn(),
    };
    return {outline, removeTab};
}

/** 验证 Outline WebSocket 命令在无状态分派后保持原有副作用。 */
describe("Outline message dispatch", () => {
    it("updates the local tab title for a matching rename", () => {
        const {outline} = createOutline();

        分发消息回调逻辑(outline, {cmd: "rename", data: {id: "doc-id", title: "Renamed"}} as IWebSocketData);

        expect(outline.parent.updateTitle).toHaveBeenCalledWith("Renamed");
        expect(outline.updateDocTitle).not.toHaveBeenCalled();
    });

    it("updates the panel title for a pinned rename", () => {
        const {outline} = createOutline("pin");

        分发消息回调逻辑(outline, {cmd: "rename", data: {id: "doc-id", title: "Renamed"}} as IWebSocketData);

        expect(outline.updateDocTitle).toHaveBeenCalledWith({title: "Renamed", icon: "zwsp"}, -1);
    });

    it("closes only a matching local outline for removeDoc", () => {
        const {outline, removeTab} = createOutline();

        分发消息回调逻辑(outline, {cmd: "removeDoc", data: {ids: ["doc-id"]}} as IWebSocketData);
        分发消息回调逻辑(outline, {cmd: "unknown", data: {}} as IWebSocketData);

        expect(removeTab).toHaveBeenCalledWith("tab-id");
        expect(removeTab).toHaveBeenCalledTimes(1);
    });
});

describe("Outline editor context", () => {
    it("resolves the editor and heading block for the Outline document", () => {
        const {outline} = createOutline();
        const editorElement = document.createElement("div");
        const blockElement = document.createElement("div");
        blockElement.dataset.nodeId = "heading-id";
        editorElement.append(blockElement);
        const protyle = {block: {rootID: "doc-id"}, wysiwyg: {element: editorElement}};
        editorContextRuntime.getAllModels.mockReturnValue({editor: [{editor: {protyle}}]});
        const outlineElement = document.createElement("div");
        outlineElement.dataset.nodeId = "heading-id";

        expect(getProtyleAndBlockElement(outline, outlineElement)).toEqual({protyle, blockElement});
    });

    it("does not return another document editor or a missing block", () => {
        const {outline} = createOutline();
        editorContextRuntime.getAllModels.mockReturnValue({
            editor: [{editor: {protyle: {block: {rootID: "other-doc"}, wysiwyg: {element: document.createElement("div")}}}}],
        });
        const outlineElement = document.createElement("div");
        outlineElement.dataset.nodeId = "heading-id";

        expect(getProtyleAndBlockElement(outline, outlineElement)).toBeUndefined();
    });
});
