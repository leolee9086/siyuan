import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVAttributeTableTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/attributeTable/avAttributeTable";

const actions = [
    "sortAttrViewKey",
    "removeAttrViewBlock",
    "insertAttrViewBlock",
    "updateAttrViewCell",
    "sortAttrViewRow",
] as const;

describe("AV attribute table transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s as part of the complete attribute table lifecycle", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "row-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-row-id"}];
        const callback = vi.fn();

        submitAVAttributeTableTransaction({protyle, doOperations, undoOperations, callback});

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({
            protyle,
            doOperations,
            undoOperations,
            callback,
        });
    });

    it("preserves an absent undo and callback without synthesizing lifecycle fields", () => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action: "removeAttrViewBlock", id: "row-id"}];

        submitAVAttributeTableTransaction({protyle, doOperations});

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVAttributeTableTransaction({protyle: {} as IProtyle, doOperations: [invalidOperation]}))
            .toThrow("AV attribute table transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
