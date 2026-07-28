import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {BlockPanel} from "../../src/block/panel/Panel";
import type {BlockPanelDomain} from "../../src/block/panel/Panel.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type BlockPanelContract = PublicInstanceLooksLike<typeof BlockPanel, BlockPanelDomain>;
const blockPanelContract: BlockPanelContract = true;

describe("BlockPanel domain contract", () => {
    it("matches the complete public class surface", () => {
        assert.equal(blockPanelContract, true);
    });
});
