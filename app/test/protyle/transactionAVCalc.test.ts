import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVCalcTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/avCalc";

const createOperation = (action: "setAttrViewColCalc" | "updateAttrViewColRollup"): IOperation => ({
    action,
    avID: "av-id",
    id: "column-id",
    data: {},
});

describe("AV calc transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(["setAttrViewColCalc", "updateAttrViewColRollup"] as const)(
        "accepts %s and forwards the complete transaction",
        action => {
            const protyle = {} as IProtyle;
            const doOperations = [createOperation(action)];
            const undoOperations = [createOperation(action)];

            submitAVCalcTransaction(protyle, doOperations, undoOperations);

            expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
        }
    );

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVCalcTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV calc transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
