import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {Dialog} from "../../src/dialog";
import type {IDialog} from "../../src/dialog/dialog.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type DialogContract = PublicInstanceLooksLike<typeof Dialog, IDialog>;

const dialogContract: DialogContract = true;

describe("Dialog domain contract", () => {
    it("keeps the complete concrete public surface equal to IDialog", () => {
        assert.equal(dialogContract, true);
    });
});
