import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVAssetTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/avAsset";

describe("AV asset transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(["updateAttrViewCell", "doUpdateUpdated"] as const)(
        "accepts %s and forwards the complete transaction",
        action => {
            const protyle = {} as IProtyle;
            const doOperations: IOperation[] = [{action, id: "asset-id"}];
            const undoOperations: IOperation[] = [{action, id: "undo-asset-id"}];

            submitAVAssetTransaction(protyle, doOperations, undoOperations);

            expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
        },
    );

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVAssetTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV asset transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
