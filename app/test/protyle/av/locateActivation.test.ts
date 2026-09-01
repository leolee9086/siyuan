import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import type {AVRenderer} from "../../../src/protyle/render/av/view/render.types";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
}));

vi.mock("../../../src/dialog/message", () => ({showMessage: vi.fn()}));
vi.mock("../../../src/protyle/wysiwyg/transaction/submit", () => ({transaction: mocks.transaction}));
vi.mock("../../../src/protyle/util/clearSelect", () => ({clearSelect: vi.fn()}));
vi.mock("../../../src/protyle/render/av/cell/decoration", () => ({addDragFill: vi.fn()}));
vi.mock("../../../src/util/DOM/highlightById", () => ({scrollCenter: vi.fn()}));

let activateAVLocate: typeof import("../../../src/protyle/render/av/locate/activation/activation").activateAVLocate;
let prepareAVLocate: typeof import("../../../src/protyle/render/av/locate/window/prepare").prepareAVLocate;
let getAVLocateRegistry: typeof import("../../../src/protyle/render/av/locate/state/state").getAVLocateRegistry;
let setAVLocateRequest: typeof import("../../../src/protyle/render/av/locate/state/state").setAVLocateRequest;
let persistAVLocateView: typeof import("../../../src/protyle/render/av/locate/state/state").persistAVLocateView;
let resetAVLocateRegistry: typeof import("../../../src/protyle/render/av/locate/state/state").resetAVLocateRegistry;

beforeAll(async () => {
    ({activateAVLocate} = await import("../../../src/protyle/render/av/locate/activation/activation"));
    ({prepareAVLocate} = await import("../../../src/protyle/render/av/locate/window/prepare"));
    ({getAVLocateRegistry, setAVLocateRequest, persistAVLocateView, resetAVLocateRegistry} = await import("../../../src/protyle/render/av/locate/state/state"));
});

afterEach(() => {
    resetAVLocateRegistry();
    document.body.innerHTML = "";
    vi.clearAllMocks();
});

describe("AV locate activation", () => {
    it("defers the injected root renderer and reuses matching local AV data", async () => {
        const editorElement = document.createElement("div");
        const blockElement = document.createElement("div");
        blockElement.className = "av";
        blockElement.dataset.nodeId = "block-id";
        blockElement.setAttribute("data-render", "true");
        editorElement.append(blockElement);
        document.body.append(editorElement);

        const protyle = Object.assign({} as IProtyle, {
            element: editorElement,
            wysiwyg: {element: editorElement},
        });
        const data = {
            id: "av-id",
            viewID: "view-id",
            viewType: "table",
            view: {
                id: "view-id",
                pageSize: 20,
                rows: [{id: "item-id"}],
            },
        } as IAV;
        prepareAVLocate(blockElement, data, {virtualData: {}});
        const renderAV = vi.fn<AVRenderer>(async () => undefined);

        expect(activateAVLocate({renderAV, protyle, blockID: "block-id"}, {itemID: "item-id"})).toBe(true);
        expect(renderAV).not.toHaveBeenCalled();

        await Promise.resolve();

        expect(renderAV).toHaveBeenCalledTimes(1);
        const renderCall = renderAV.mock.calls[0];
        if (!renderCall) {
            throw new Error("AV locate activation expected one root render call");
        }
        const [element, renderProtyle, callback, renderAll, localData] = renderCall;
        expect(element).toBe(blockElement);
        expect(renderProtyle).toBe(protyle);
        expect(callback).toBeUndefined();
        expect(renderAll).toBe(true);
        expect(localData).toMatchObject({
            id: "av-id",
            target: {
                status: "visible",
                itemID: "item-id",
                index: 0,
                offset: 0,
                pageSize: 20,
            },
        });
        expect(blockElement.hasAttribute("data-render")).toBe(false);
    });

    it("persists a requested view once before the next AV render", () => {
        const blockElement = document.createElement("div");
        blockElement.className = "av";
        blockElement.dataset.nodeId = "block-id";
        blockElement.dataset.avId = "av-id";
        document.body.append(blockElement);
        const request = {itemID: "item-id", viewID: "next-view", previousViewID: "current-view"};
        setAVLocateRequest(blockElement, request);
        const data = {
            viewID: "current-view",
            viewType: "table",
            target: {status: "visible", itemID: "item-id", index: 0, offset: 0, pageSize: 20},
        } as unknown as IAV;
        const protyle = {disabled: false} as IProtyle;

        expect(persistAVLocateView(blockElement, protyle, data)).toBe(true);
        expect(blockElement.getAttribute("custom-sy-av-view")).toBe("next-view");
        expect(blockElement.getAttribute("data-av-type")).toBe("table");
        expect(mocks.transaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewBlockView", id: "next-view", blockID: "block-id", avID: "av-id",
        }], [{
            action: "setAttrViewBlockView", id: "current-view", blockID: "block-id", avID: "av-id",
        }]);
        expect(persistAVLocateView(blockElement, protyle, data)).toBe(false);
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
    });

    it("uses the custom gallery card width when aligning the locate window", () => {
        const blockElement = document.createElement("div");
        blockElement.className = "av";
        Object.defineProperty(blockElement, "clientWidth", {configurable: true, value: 640});
        const bodyElement = document.createElement("div");
        bodyElement.className = "av__body";
        const cardElement = document.createElement("div");
        cardElement.className = "av__gallery-item";
        Object.defineProperty(cardElement, "offsetHeight", {configurable: true, value: 200});
        bodyElement.append(cardElement);
        blockElement.append(bodyElement);
        document.body.append(blockElement);
        setAVLocateRequest(blockElement, {itemID: "item-351"});

        const data = {
            id: "av-id",
            viewID: "view-id",
            viewType: "gallery",
            view: {
                id: "view-id",
                pageSize: 20,
                cardSize: 0,
                cardWidth: 600,
                cards: Array.from({length: 500}, (_, index) => ({id: `item-${index}`})),
            },
            target: {
                status: "visible",
                itemID: "item-351",
                index: 351,
                offset: 0,
                pageSize: 20,
            },
        } as unknown as IAV;
        const virtualData: { [key: string]: IAVVirtualData } = {};

        prepareAVLocate(blockElement, data, {virtualData});

        expect(virtualData.all).toMatchObject({
            renderedStart: 251,
            renderedEnd: 450,
            topSpacerHeight: 54216,
        });
    });

    it("resets queued timers and active highlight DOM from the unified registry", () => {
        const registry = getAVLocateRegistry();
        const queuedTimer = window.setTimeout(vi.fn(), 30000);
        registry.queuedLocateRequests.set("block-id", {
            request: {itemID: "item-id"},
            timer: queuedTimer,
        });
        const highlightedElement = document.createElement("div");
        highlightedElement.classList.add("av__row--locate");
        const highlightTimer = window.setTimeout(vi.fn(), 30000);
        const highlightState = {
            element: highlightedElement,
            className: "av__row--locate",
            timer: highlightTimer,
        };
        registry.highlightStates.set(highlightedElement, highlightState);
        registry.activeHighlights.add(highlightState);

        resetAVLocateRegistry();

        expect(highlightedElement.classList.contains("av__row--locate")).toBe(false);
        const nextRegistry = getAVLocateRegistry();
        expect(nextRegistry).not.toBe(registry);
        expect(nextRegistry.queuedLocateRequests.size).toBe(0);
        expect(nextRegistry.activeHighlights.size).toBe(0);
    });
});
