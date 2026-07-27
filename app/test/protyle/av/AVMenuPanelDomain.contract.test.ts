import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {avMenuPanel} from "../../../src/protyle/render/av/openMenuPanel";
import type {AVMenuPanelDomain} from "../../../src/protyle/render/av/openMenuPanel.types";
import type {StrictEqual} from "../../../src/util/types/LooksLike.types";

type AVMenuPanelContract = StrictEqual<typeof avMenuPanel, AVMenuPanelDomain>;
const avMenuPanelContract: AVMenuPanelContract = true;

describe("AV menu panel domain contract", () => {
    it("matches the complete public functional surface in both directions", () => {
        assert.equal(avMenuPanelContract, true);
    });
});
