import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVFilterTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avFilter";

describe("AV filter transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards the filter tree do and undo operations", () => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action: "setAttrViewFilters", id: "view-id"}];
        const undoOperations: IOperation[] = [{action: "setAttrViewFilters", id: "undo-view-id"}];

        submitAVFilterTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVFilterTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV filter transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
