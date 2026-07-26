import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/applied/imports", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAppliedAVViewTransaction} from "../../src/protyle/wysiwyg/transaction/applied/avView";

const createViewOperation = (id: string): IOperation => ({
    action: "setAttrViewBlockView",
    blockID: "block-id",
    avID: "av-id",
    id,
});

describe("applied AV view transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards validated view operations to the prepared transaction kernel", () => {
        const protyle = {} as IProtyle;
        const doOperations = [createViewOperation("next-view")];
        const undoOperations = [createViewOperation("previous-view")];

        submitAppliedAVViewTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects operations outside the view command before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAppliedAVViewTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("Applied AV view transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
