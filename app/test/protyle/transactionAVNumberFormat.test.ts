import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVNumberFormatTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avNumberFormat";

describe("AV number format transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards the number format do and undo operations", () => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action: "updateAttrViewColNumberFormat", id: "column-id"}];
        const undoOperations: IOperation[] = [{action: "updateAttrViewColNumberFormat", id: "undo-column-id"}];

        submitAVNumberFormatTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVNumberFormatTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV number format transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
