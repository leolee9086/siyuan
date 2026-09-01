import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
    const observer = {
        disconnect: vi.fn(),
        observe: vi.fn(),
    };
    return {
        fetchPost: vi.fn(),
        focusBlock: vi.fn(),
        highlightById: vi.fn(),
        observer,
        preventScroll: vi.fn(),
        pushBack: vi.fn(),
        scrollCenter: vi.fn(),
        switchTab: vi.fn(),
    };
});

vi.mock("../../src/editor/imports", () => ({
    Constants: {
        CB_GET_CONTEXT: "context",
        CB_GET_FOCUS: "focus",
        CB_GET_HL: "highlight",
        CB_GET_OUTLINE: "outline",
    },
    fetchPost: mocks.fetchPost,
    focusBlock: mocks.focusBlock,
    focusByRange: vi.fn(),
    getSiyuanConfig: vi.fn(),
    hasClosestBlock: vi.fn(),
    highlightById: mocks.highlightById,
    isEncryptedBox: vi.fn(),
    isInEmbedBlock: vi.fn(() => false),
    onGet: vi.fn(),
    preventScroll: mocks.preventScroll,
    pushBack: mocks.pushBack,
    scrollCenter: mocks.scrollCenter,
    zoomOut: vi.fn(),
}));

vi.mock("../../src/editor/util.updateBacklinkGraph", () => ({
    updateBacklinkGraph: vi.fn(),
}));

vi.mock("../../src/editor/factory/createUserScrollObserver.factory", () => ({
    createUserScrollObserver: vi.fn(() => ({
        abortController: new AbortController(),
        observer: mocks.observer,
    })),
}));

import {switchEditor} from "../../src/editor/util.switchEditor";

const createEditor = () => {
    const contentElement = document.createElement("div");
    const wysiwygElement = document.createElement("div");
    const nodeElement = document.createElement("div");
    nodeElement.dataset.nodeId = "target";
    Object.defineProperty(nodeElement, "clientHeight", {value: 1});
    wysiwygElement.append(nodeElement);
    document.body.append(contentElement, wysiwygElement);
    return {
        contentElement,
        editor: {
            editor: {
                protyle: {
                    contentElement,
                    toolbar: {},
                    wysiwyg: {element: wysiwygElement},
                },
            },
            parent: {
                headElement: document.createElement("div"),
                parent: {
                    showHeading: vi.fn(),
                    switchTab: mocks.switchTab,
                },
            },
        },
    };
};

describe("editor focus observer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.useRealTimers();
    });

    it("stops automatic recentering when the user starts scrolling", async () => {
        const {contentElement, editor} = createEditor();

        await Reflect.apply(switchEditor, undefined, [editor, {
            action: ["focus"],
            id: "target",
            rootID: "root",
        }, {}]);
        contentElement.dispatchEvent(new Event("wheel"));

        expect(mocks.observer.observe).toHaveBeenCalledOnce();
        expect(mocks.observer.disconnect).toHaveBeenCalledOnce();
        vi.runOnlyPendingTimers();
    });
});
