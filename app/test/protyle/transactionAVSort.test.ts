import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVSortTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/view/avSort";

describe("AV sort transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards the complete sort list do and undo operations", () => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action: "setAttrViewSorts", id: "view-id"}];
        const undoOperations: IOperation[] = [{action: "setAttrViewSorts", id: "undo-view-id"}];

        submitAVSortTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVSortTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV sort transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
