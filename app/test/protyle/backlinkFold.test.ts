import {describe, expect, it} from "vitest";
import {foldPassiveType} from "../../src/protyle/wysiwyg/backlink/foldPassiveType";

describe("backlink passive folding", () => {
    it("folds the outer list when backlink expansion is disabled", () => {
        const element = document.createElement("div");
        element.innerHTML = '<div class="li"><div></div></div>';

        foldPassiveType(false, element);

        expect(element.firstElementChild?.getAttribute("fold")).toBe("1");
    });

    it("folds only nested list items with more than three children when expanded", () => {
        const element = document.createElement("div");
        element.innerHTML = '<div class="li"><div class="li" id="long"><i></i><i></i><i></i><i></i></div><div class="li" id="short"><i></i></div></div>';

        foldPassiveType(true, element);

        expect(element.querySelector("#long")?.getAttribute("fold")).toBe("1");
        expect(element.querySelector("#short")?.hasAttribute("fold")).toBe(false);
    });

    it("inserts one more marker and hides the trailing heading content", () => {
        const element = document.createElement("div");
        element.innerHTML = '<div data-type="NodeHeading"></div><p>one</p><p>two</p><p id="three">three</p><p id="four">four</p>';

        foldPassiveType(true, element);

        expect(element.querySelectorAll(".protyle-breadcrumb__item")).toHaveLength(1);
        expect(element.querySelector("#three")?.classList.contains("fn__none")).toBe(true);
        expect(element.querySelector("#four")?.classList.contains("fn__none")).toBe(true);
    });
});
