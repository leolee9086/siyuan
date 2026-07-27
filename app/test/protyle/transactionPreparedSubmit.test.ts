import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    countBlockWord: vi.fn(),
    fetchPost: vi.fn(),
    markTransactionSyncPending: vi.fn(),
    queueTransaction: vi.fn(),
    registerTransactionUndo: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/imports", () => ({
    Constants: {SIYUAN_APPID: "app-id"},
    countBlockWord: mocks.countBlockWord,
    fetchPost: mocks.fetchPost,
    markTransactionSyncPending: mocks.markTransactionSyncPending,
    queueTransaction: mocks.queueTransaction,
    registerTransactionUndo: mocks.registerTransactionUndo,
}));

import {submitPreparedTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/submit";

const createProtyle = (lite = false) => {
    const wysiwygElement = document.createElement("div");
    const selected = document.createElement("div");
    selected.className = "protyle-wysiwyg--select";
    selected.dataset.nodeId = "selected-id";
    wysiwygElement.append(selected);
    return Object.assign({} as IProtyle, {
        id: "session-id",
        lite,
        block: {rootID: "root-id"},
        wysiwyg: {element: wysiwygElement},
    });
};

describe("prepared transaction submission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.queueTransaction.mockImplementation((_protyle, task: () => Promise<void>) => task());
        mocks.fetchPost.mockImplementation(async (_url, _payload, callback: () => void) => callback());
    });

    it("preserves undo, sync indicator, queue, request, and word-count order", async () => {
        const protyle = createProtyle();
        const doOperations: IOperation[] = [{action: "setAttrViewBlockView", id: "next"}];
        const undoOperations: IOperation[] = [{action: "setAttrViewBlockView", id: "previous"}];

        submitPreparedTransaction({protyle, doOperations, undoOperations});
        await Promise.resolve();

        expect(mocks.registerTransactionUndo).toHaveBeenCalledWith(protyle, doOperations, undoOperations);
        const undoOrder = mocks.registerTransactionUndo.mock.invocationCallOrder[0];
        const syncOrder = mocks.markTransactionSyncPending.mock.invocationCallOrder[0];
        const queueOrder = mocks.queueTransaction.mock.invocationCallOrder[0];
        if (undoOrder === undefined || syncOrder === undefined || queueOrder === undefined) {
            throw new Error("Expected prepared transaction lifecycle calls");
        }
        expect(undoOrder).toBeLessThan(syncOrder);
        expect(syncOrder).toBeLessThan(queueOrder);
        expect(mocks.fetchPost).toHaveBeenCalledWith("/api/transactions", {
            session: "session-id",
            app: "app-id",
            transactions: [{doOperations, undoOperations}],
        }, expect.any(Function));
        expect(mocks.countBlockWord).toHaveBeenCalledWith(["selected-id"], "root-id", true);
    });

    it("runs the calling domain callback only after the successful response lifecycle", async () => {
        const callback = vi.fn();
        submitPreparedTransaction({
            protyle: createProtyle(),
            doOperations: [{action: "removeAttrViewBlock", id: "row-id"}],
            callback,
        });
        await Promise.resolve();

        expect(callback).toHaveBeenCalledOnce();
        const wordCountOrder = mocks.countBlockWord.mock.invocationCallOrder[0];
        const callbackOrder = callback.mock.invocationCallOrder[0];
        if (wordCountOrder === undefined || callbackOrder === undefined) {
            throw new Error("Expected word count and domain callback lifecycle calls");
        }
        expect(wordCountOrder).toBeLessThan(callbackOrder);
        expect(mocks.registerTransactionUndo).toHaveBeenCalledWith(
            expect.anything(),
            [{action: "removeAttrViewBlock", id: "row-id"}],
            undefined,
        );
    });

    it("keeps lite transactions local after undo registration", () => {
        const protyle = createProtyle(true);
        const doOperations: IOperation[] = [{action: "setAttrViewBlockView", id: "next"}];

        submitPreparedTransaction({protyle, doOperations, undoOperations: []});

        expect(mocks.registerTransactionUndo).toHaveBeenCalledOnce();
        expect(mocks.markTransactionSyncPending).not.toHaveBeenCalled();
        expect(mocks.queueTransaction).not.toHaveBeenCalled();
    });

    it("does not register or submit an empty transaction", () => {
        submitPreparedTransaction({protyle: createProtyle(), doOperations: [], undoOperations: []});

        expect(mocks.registerTransactionUndo).not.toHaveBeenCalled();
        expect(mocks.queueTransaction).not.toHaveBeenCalled();
    });
});
