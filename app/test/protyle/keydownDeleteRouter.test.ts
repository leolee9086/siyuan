import {describe, expect, it} from "vitest";
import {
    CROSS_BLOCK_DELETE_COMMANDS,
    routeCrossBlockDeleteCommand,
} from "../../src/protyle/wysiwyg/keydown.delete.crossBlock";

describe("cross-block deletion state routing", () => {
    it("keeps non-delete and empty single-block states out of the removal transaction", () => {
        expect(routeCrossBlockDeleteCommand({
            removalRequested: false,
            selection: "cross-block-content",
            hasReferenceTargets: true,
        })).toBe(CROSS_BLOCK_DELETE_COMMANDS.IGNORE);
        expect(routeCrossBlockDeleteCommand({
            removalRequested: true,
            selection: "other",
            hasReferenceTargets: false,
        })).toBe(CROSS_BLOCK_DELETE_COMMANDS.IGNORE);
    });

    it("routes cross-block content and reference-targeted deletion to distinct commands", () => {
        expect(routeCrossBlockDeleteCommand({
            removalRequested: true,
            selection: "cross-block-content",
            hasReferenceTargets: false,
        })).toBe(CROSS_BLOCK_DELETE_COMMANDS.REMOVE_CROSS_BLOCK_SELECTION);
        expect(routeCrossBlockDeleteCommand({
            removalRequested: true,
            selection: "other",
            hasReferenceTargets: true,
        })).toBe(CROSS_BLOCK_DELETE_COMMANDS.REMOVE_REFERENCE_TARGETED_SELECTION);
    });
});
