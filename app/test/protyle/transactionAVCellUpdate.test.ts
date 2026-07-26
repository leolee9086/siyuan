import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVCellUpdateTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/avCellUpdate";

const actions = [
    "updateAttrViewCell",
    "updateAttrViewColOptions",
    "removeAttrViewColOption",
    "doUpdateUpdated",
] as const;

describe("AV cell update transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "cell-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-cell-id"}];

        submitAVCellUpdateTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVCellUpdateTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV cell update transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
