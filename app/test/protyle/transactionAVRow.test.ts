import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVRowTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/avRow";

const actions = [
    "setAttrViewPageSize",
    "insertAttrViewBlock",
    "removeAttrViewBlock",
    "duplicateAttrViewRow",
    "doUpdateUpdated",
] as const;

describe("AV row transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "row-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-row-id"}];

        submitAVRowTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVRowTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV row transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
