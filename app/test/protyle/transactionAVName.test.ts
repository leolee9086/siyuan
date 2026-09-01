import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVNameTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avName";

describe("AV name transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(["setAttrViewName", "doUpdateUpdated"] as const)(
        "accepts %s and forwards the complete transaction",
        action => {
            const protyle = {} as IProtyle;
            const doOperations: IOperation[] = [{action, id: "name-id"}];
            const undoOperations: IOperation[] = [{action, id: "undo-name-id"}];

            submitAVNameTransaction({protyle, doOperations, undoOperations});

            expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
        },
    );

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVNameTransaction({
            protyle: {} as IProtyle,
            doOperations: [invalidOperation],
            undoOperations: [],
        }))
            .toThrow("AV name transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
