import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVRelationTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avRelation";

const actions = [
    "updateAttrViewColRelation",
    "insertAttrViewBlock",
    "updateAttrViewCell",
    "doUpdateUpdated",
] as const;

describe("AV relation transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "relation-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-relation-id"}];

        submitAVRelationTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("preserves a relation commit without undo operations", () => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action: "insertAttrViewBlock", id: "relation-id"}];

        submitAVRelationTransaction(protyle, doOperations, []);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations: []});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVRelationTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV relation transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
