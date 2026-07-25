import {beforeEach, describe, expect, it} from "vitest";
import {syncAVPageSize} from "../../../src/protyle/render/av/view/pagination";

beforeEach(() => {
    document.body.innerHTML = "";
});

const createAV = (viewType: "table" | "gallery", pageSize?: string) => {
    const block = document.createElement("div");
    block.dataset.avType = viewType;
    const body = document.createElement("div");
    body.className = "av__body";
    if (pageSize) {
        body.dataset.pageSize = pageSize;
    }
    block.append(body);
    document.body.append(block);
    return {block, body};
};

describe("AV page size synchronization", () => {
    it("counts table rows without the header", () => {
        const {block, body} = createAV("table", "1");
        body.innerHTML = '<div class="av__row av__row--header"></div><div class="av__row"></div><div class="av__row"></div>';

        syncAVPageSize(block);

        expect(body.dataset.pageSize).toBe("2");
    });

    it("counts gallery items and never shrinks an existing page size", () => {
        const {block, body} = createAV("gallery", "3");
        body.innerHTML = '<div class="av__gallery-item"></div><div class="av__gallery-item"></div>';

        syncAVPageSize(block);

        expect(body.dataset.pageSize).toBe("3");
    });

    it("leaves bodies without paging state untouched", () => {
        const {block, body} = createAV("gallery");
        body.innerHTML = '<div class="av__gallery-item"></div>';

        syncAVPageSize(block);

        expect(body.dataset.pageSize).toBeUndefined();
    });
});
