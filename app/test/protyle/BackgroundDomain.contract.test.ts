import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {Background} from "../../src/protyle/header/Background";
import type {BackgroundDomain} from "../../src/protyle/header/background/background.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type BackgroundContract = PublicInstanceLooksLike<typeof Background, BackgroundDomain>;
const backgroundContract: BackgroundContract = true;

describe("Background domain contract", () => {
    it("matches the complete public class surface", () => {
        assert.equal(backgroundContract, true);
    });
});
