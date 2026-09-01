import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitPreparedTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/submit", () => ({
    submitPreparedTransaction: mocks.submitPreparedTransaction,
}));

import {submitAVGallerySettingTransaction} from "../../src/protyle/wysiwyg/transaction/prepared/av/view/avGallery";

const legacyActions = [
    "setAttrViewCardSize",
    "setAttrViewCardAspectRatio",
] as const;

const currentActions = [
    "setAttrViewCardWidth",
    "setAttrViewCardAspectRatioValue",
] as const;

const actions = [
    "setAttrViewCoverFrom",
    "setAttrViewCoverFromAssetKeyID",
    ...legacyActions,
    ...currentActions,
] as const;

describe("AV gallery setting transaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(actions)("accepts %s and forwards the complete transaction", action => {
        const protyle = {} as IProtyle;
        const doOperations: IOperation[] = [{action, id: "gallery-id"}];
        const undoOperations: IOperation[] = [{action, id: "undo-gallery-id"}];

        submitAVGallerySettingTransaction(protyle, doOperations, undoOperations);

        expect(mocks.submitPreparedTransaction).toHaveBeenCalledWith({protyle, doOperations, undoOperations});
    });

    it("rejects unrelated actions before submission", () => {
        const invalidOperation: IOperation = {action: "delete", id: "block-id"};

        expect(() => submitAVGallerySettingTransaction({} as IProtyle, [invalidOperation], []))
            .toThrow("AV gallery setting transaction does not accept action delete");
        expect(mocks.submitPreparedTransaction).not.toHaveBeenCalled();
    });
});
