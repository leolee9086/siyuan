import {describe, expect, it} from "vitest";
import {getKeyByLiElement} from "../../src/search/result/searchResultKey";

describe("search result key", () => {
    it("deduplicates content marks in document order", () => {
        const item = document.createElement("div");
        item.innerHTML = '<span class="b3-list-item__text"><mark>alpha</mark><mark>beta</mark><mark>alpha</mark></span>';

        expect(getKeyByLiElement(item)).toBe("alpha beta");
    });

    it("uses metadata marks only when content has no mark", () => {
        const item = document.createElement("div");
        item.innerHTML = '<span class="b3-list-item__text">plain</span><span class="b3-list-item__meta"><mark>path</mark></span>';

        expect(getKeyByLiElement(item)).toBe("path");
    });
});
