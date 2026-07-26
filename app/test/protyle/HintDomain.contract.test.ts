import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {Hint} from "../../src/protyle/hint";
import type {HintDomain} from "../../src/protyle/hint/hint.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type HintContract = PublicInstanceLooksLike<typeof Hint, HintDomain>;
const hintContract: HintContract = true;

describe("Hint domain contract", () => {
    it("matches the complete public class surface", () => {
        assert.equal(hintContract, true);
    });
});
