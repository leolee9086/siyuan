import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVViewTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/view/avView";

const actions = [
    "addAttrViewView",
    "removeAttrViewView",
    "duplicateAttrViewView",
    "sortAttrViewView",
    "setAttrViewViewName",
    "setAttrViewViewDesc",
    "setAttrViewViewIcon",
    "setAttrViewBlockView",
] as const;

describe("AV view transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "view-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-view-id"}];

        submitAVViewTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVViewTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV view transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
