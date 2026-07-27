import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVLayoutSettingTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/view/avLayout";

const actions = [
    "hideAttrViewName",
    "setAttrViewShowIcon",
    "setAttrViewWrapField",
    "setAttrViewFitImage",
    "setAttrViewDisplayFieldName",
    "setAttrViewFillColBackgroundColor",
] as const;

describe("AV layout setting transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "layout-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-layout-id"}];

        submitAVLayoutSettingTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVLayoutSettingTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV layout setting transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
