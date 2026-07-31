import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {ForgeRuntimeControl} from "../../src/sforge/forgeRuntime";
import type {ForgeRuntimeControlDomain} from "../../src/sforge/forgeRuntime/forgeRuntimeControl.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type ForgeRuntimeControlContract = PublicInstanceLooksLike<typeof ForgeRuntimeControl, ForgeRuntimeControlDomain>;

const forgeRuntimeControlContract: ForgeRuntimeControlContract = true;

describe("Forge Runtime control domain contract", () => {
    it("keeps the registry-facing class surface equal to its abstract root", () => {
        assert.equal(forgeRuntimeControlContract, true);
    });
});
