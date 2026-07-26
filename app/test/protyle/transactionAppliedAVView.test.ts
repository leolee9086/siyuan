import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    countBlockWord: vi.fn(),
    fetchPost: vi.fn(),
    queueTransaction: vi.fn(),
    registerTransactionUndo: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/applied/imports", () => ({
    Constants: {SIYUAN_APPID: "app-id"},
    countBlockWord: mocks.countBlockWord,
    fetchPost: mocks.fetchPost,
    queueTransaction: mocks.queueTransaction,
    registerTransactionUndo: mocks.registerTransactionUndo,
}));

import {submitAppliedAVViewTransaction} from "../../src/protyle/wysiwyg/transaction/applied/avView";

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

const createViewOperation = (id: string): IOperation => ({
    action: "setAttrViewBlockView",
    blockID: "block-id",
    avID: "av-id",
    id,
});

describe("applied AV view transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.queueTransaction.mockImplementation((_protyle, task: () => Promise<void>) => task());
        mocks.fetchPost.mockImplementation(async (_url, _payload, callback: (response: IWebSocketData) => void) => {
            callback({code: 0, data: [{doOperations: []}]});
        });
    });

    it("registers undo before serializing the already-applied view change", async () => {
        const protyle = createProtyle();
        const doOperations = [createViewOperation("next-view")];
        const undoOperations = [createViewOperation("previous-view")];

        submitAppliedAVViewTransaction(protyle, doOperations, undoOperations);
        await Promise.resolve();

        expect(mocks.registerTransactionUndo).toHaveBeenCalledWith(protyle, doOperations, undoOperations);
        expect(mocks.registerTransactionUndo.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.queueTransaction.mock.invocationCallOrder[0]);
        expect(mocks.fetchPost).toHaveBeenCalledWith("/api/transactions", {
            session: "session-id",
            app: "app-id",
            transactions: [{doOperations, undoOperations}],
        }, expect.any(Function));
        expect(mocks.countBlockWord).toHaveBeenCalledWith(["selected-id"], "root-id", true);
    });

    it("keeps lite transactions local after undo registration", () => {
        const protyle = createProtyle(true);
        const doOperations = [createViewOperation("next-view")];
        const undoOperations = [createViewOperation("previous-view")];

        submitAppliedAVViewTransaction(protyle, doOperations, undoOperations);

        expect(mocks.registerTransactionUndo).toHaveBeenCalledOnce();
        expect(mocks.queueTransaction).not.toHaveBeenCalled();
    });

    it("rejects operations whose DOM synchronization was not declared by this command", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAppliedAVViewTransaction(createProtyle(), [invalidOperation], []))
            .toThrow("Applied AV view transaction does not accept action delete");
        expect(mocks.registerTransactionUndo).not.toHaveBeenCalled();
        expect(mocks.queueTransaction).not.toHaveBeenCalled();
    });
});
