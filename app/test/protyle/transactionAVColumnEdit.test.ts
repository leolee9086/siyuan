import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVColumnEditTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/avColumnEdit";

const actions = [
    "updateAttrViewCol",
    "setAttrViewColIcon",
    "setAttrViewColDesc",
    "updateAttrViewColTemplate",
    "setAttrViewUpdatedIncludeTime",
    "setAttrViewCreatedIncludeTime",
    "setAttrViewColWrap",
    "updateAttrViewColOptions",
    "removeAttrViewColOption",
    "setAttrViewColDateFillCreated",
    "setAttrViewColDateFillSpecificTime",
] as const;

describe("AV column edit transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "column-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-column-id"}];

        submitAVColumnEditTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVColumnEditTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV column edit transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
