import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import type {AVRenderer} from "../../../src/protyle/render/av/view/render.types";

vi.mock("../../../src/dialog/message", () => ({showMessage: vi.fn()}));
vi.mock("../../../src/protyle/wysiwyg/transaction/submit", () => ({transaction: vi.fn()}));
vi.mock("../../../src/protyle/util/clearSelect", () => ({clearSelect: vi.fn()}));
vi.mock("../../../src/protyle/render/av/cell/decoration", () => ({addDragFill: vi.fn()}));
vi.mock("../../../src/util/DOM/highlightById", () => ({scrollCenter: vi.fn()}));

let activateAVLocate: typeof import("../../../src/protyle/render/av/locate/activation/activation").activateAVLocate;
let prepareAVLocate: typeof import("../../../src/protyle/render/av/locate/window/prepare").prepareAVLocate;
let getAVLocateRegistry: typeof import("../../../src/protyle/render/av/locate/state/state").getAVLocateRegistry;
let resetAVLocateRegistry: typeof import("../../../src/protyle/render/av/locate/state/state").resetAVLocateRegistry;

beforeAll(async () => {
    ({activateAVLocate} = await import("../../../src/protyle/render/av/locate/activation/activation"));
    ({prepareAVLocate} = await import("../../../src/protyle/render/av/locate/window/prepare"));
    ({getAVLocateRegistry, resetAVLocateRegistry} = await import("../../../src/protyle/render/av/locate/state/state"));
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
