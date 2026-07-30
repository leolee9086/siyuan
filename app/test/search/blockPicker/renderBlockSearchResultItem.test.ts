import {describe, expect, it} from "vitest";
import {renderBlockSearchResultItem} from "../../../src/search/blockPicker/renderBlockSearchResultItem";

describe("renderBlockSearchResultItem", () => {
    it("preserves the Protyle block preview hooks when a canonical block ID is present", () => {
        const html = renderBlockSearchResultItem({
            id: "20260730000000-block",
            type: "NodeDocument",
            content: "Agent Charter",
            hPath: "/Agent Charter",
            ial: {},
        });

        expect(html).toContain('data-id="20260730000000-block"');
        expect(html).toContain('data-node-id="20260730000000-block"');
        expect(html).toContain("popover__block");
    });

    it("renders a search candidate without registering a preview for an unresolved identifier", () => {
        const html = renderBlockSearchResultItem({
            type: "NodeDocument",
            content: "Agent Charter",
            hPath: "/Agent Charter",
            ial: {},
        });

        expect(html).not.toContain("data-id=");
        expect(html).not.toContain("data-node-id=");
        expect(html).not.toContain("popover__block");
    });
});
