import {beforeEach, describe, expect, it, vi} from "vitest";

const services = vi.hoisted(() => ({
    promiseTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction.promise", () => ({
    promiseTransaction: services.promiseTransaction,
}));

import {transaction} from "../../src/protyle/wysiwyg/transaction/submit";
import {removeTopElementAndCollectOperations} from "../../src/protyle/wysiwyg/transaction/removeTopElement";

const createProtyle = (lite: boolean) => {
    const headElement = document.createElement("div");
    headElement.classList.add("item--unupdate");
    return {
        headElement,
        protyle: {
            lite,
            model: {headElement},
            observerLoad: {disconnect: vi.fn()},
            undo: {add: vi.fn()},
            updated: false,
        },
    };
};

describe("transaction submit", () => {
    beforeEach(() => {
        services.promiseTransaction.mockReset();
        window.siyuan = {
            config: {fileTree: {openFilesUseCurrentTab: true}},
        };
    });

    it("short-circuits empty operation lists before touching editor state", () => {
        const state = createProtyle(true);

        transaction(state.protyle, [], [{action: "delete", id: "block-id"}]);

        expect(state.protyle.updated).toBe(false);
        expect(state.protyle.undo.add).not.toHaveBeenCalled();
        expect(state.headElement.classList.contains("item--unupdate")).toBe(true);
        expect(services.promiseTransaction).not.toHaveBeenCalled();
    });

    it("registers undo state synchronously before the lite boundary", () => {
        const state = createProtyle(true);
        const doOperations = [{action: "update", id: "block-id", data: "new"}];
        const undoOperations = [{action: "update", id: "block-id", data: "old"}];

        transaction(state.protyle, doOperations, undoOperations);

        expect(state.protyle.updated).toBe(true);
        expect(state.headElement.classList.contains("item--unupdate")).toBe(false);
        expect(state.protyle.undo.add).toHaveBeenCalledWith(doOperations, undoOperations, state.protyle);
        expect(services.promiseTransaction).not.toHaveBeenCalled();
    });

    it("starts local synchronization and disconnects insert observers", () => {
        const state = createProtyle(false);
        const doOperations = [{action: "insert", id: "block-id", data: "<div></div>"}];

        transaction(state.protyle, doOperations, undefined, {skipSync: true});

        expect(services.promiseTransaction).toHaveBeenCalledWith({
            protyle: state.protyle,
            doOperations,
            skipSync: true,
        });
        expect(state.protyle.observerLoad.disconnect).toHaveBeenCalledOnce();
    });

    it("collects a nested top-level deletion before restoring a non-root editor", () => {
        const wysiwygElement = document.createElement("div");
        wysiwygElement.classList.add("protyle-wysiwyg");
        const blockquoteElement = document.createElement("div");
        blockquoteElement.dataset.nodeId = "top-id";
        blockquoteElement.dataset.type = "NodeBlockquote";
        blockquoteElement.append(document.createElement("div"));
        const updateElement = document.createElement("div");
        updateElement.dataset.nodeId = "child-id";
        blockquoteElement.append(updateElement);
        wysiwygElement.append(blockquoteElement);
        const zoomOut = vi.fn();
        const protyle = {
            block: {id: "child-id", rootID: "root-id"},
            getInstance: () => ({zoomOut}),
            wysiwyg: {element: wysiwygElement},
        };

        const operations = removeTopElementAndCollectOperations(updateElement, protyle);

        expect(operations).toEqual([{action: "delete", id: "top-id"}]);
        expect(wysiwygElement.childElementCount).toBe(0);
        expect(zoomOut).toHaveBeenCalledWith({
            id: "root-id",
            isPushBack: false,
            focusId: "child-id",
        });
    });
});
