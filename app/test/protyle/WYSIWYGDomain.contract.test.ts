import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {WYSIWYGDomain} from "../../src/protyle/wysiwyg/domain/wysiwyg.types";
import type {WYSIWYG} from "../../src/protyle/wysiwyg";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type WYSIWYGContract = PublicInstanceLooksLike<typeof WYSIWYG, WYSIWYGDomain>;
const wysiwygContract: WYSIWYGContract = true;

describe("WYSIWYG domain contract", () => {
    it("matches the complete public class surface", () => {
        assert.equal(wysiwygContract, true);
    });
});
