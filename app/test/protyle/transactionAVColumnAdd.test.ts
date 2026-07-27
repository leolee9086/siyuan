import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVColumnAddTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avColumnAdd";

const actions = ["addAttrViewCol", "removeAttrViewCol", "doUpdateUpdated"] as const;

describe("AV column add transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "column-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-column-id"}];

        submitAVColumnAddTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVColumnAddTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV column add transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
