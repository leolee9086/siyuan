import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVGroupTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/group/avGroup";

const actions = [
    "setAttrViewGroup",
    "removeAttrViewGroup",
    "hideAttrViewGroup",
    "hideAttrViewAllGroups",
    "sortAttrViewGroup",
    "foldAttrViewGroup",
] as const;

describe("AV group transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "group-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-group-id"}];

        submitAVGroupTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVGroupTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV group transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
