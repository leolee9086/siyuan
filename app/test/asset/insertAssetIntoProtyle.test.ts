import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    focusByRange: vi.fn(),
    genAssetHTML: vi.fn(() => "<asset-html>"),
    getAssetName: vi.fn(() => "diagram"),
    hideElements: vi.fn(),
    insertHTML: vi.fn(),
    extname: vi.fn(() => ".png"),
}));

vi.mock("../../src/protyle/asset/imports", () => ({
    focusByRange: mocks.focusByRange,
    genAssetHTML: mocks.genAssetHTML,
    getAssetName: mocks.getAssetName,
    hideElements: mocks.hideElements,
    insertHTML: mocks.insertHTML,
    pathPosix: () => ({extname: mocks.extname}),
}));

import {insertAssetIntoProtyle} from "../../src/protyle/asset/insert";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("insertAssetIntoProtyle", () => {
    it("preserves focus, HTML generation, insertion and UI cleanup order", () => {
        const range = document.createRange();
        const protyle = {toolbar: {range}} as IProtyle;

        insertAssetIntoProtyle("assets/diagram.png", protyle);

        expect(mocks.focusByRange).toHaveBeenCalledWith(range);
        expect(mocks.extname).toHaveBeenCalledWith("assets/diagram.png");
        expect(mocks.getAssetName).toHaveBeenCalledWith("assets/diagram.png");
        expect(mocks.genAssetHTML).toHaveBeenCalledWith(
            ".png",
            "assets/diagram.png",
            "diagram",
            "diagram.png"
        );
        expect(mocks.insertHTML).toHaveBeenCalledWith("<asset-html>", protyle);
        expect(mocks.hideElements).toHaveBeenCalledWith(["util"], protyle);
        expect(mocks.focusByRange.mock.invocationCallOrder[0]).toBeLessThan(mocks.insertHTML.mock.invocationCallOrder[0]);
        expect(mocks.insertHTML.mock.invocationCallOrder[0]).toBeLessThan(mocks.hideElements.mock.invocationCallOrder[0]);
    });

    it("keeps external resource values as both display name and title", () => {
        const protyle = {toolbar: {range: document.createRange()}} as IProtyle;
        mocks.extname.mockReturnValueOnce(".pdf");

        insertAssetIntoProtyle("https://example.test/report.pdf", protyle);

        expect(mocks.getAssetName).not.toHaveBeenCalled();
        expect(mocks.genAssetHTML).toHaveBeenCalledWith(
            ".pdf",
            "https://example.test/report.pdf",
            "https://example.test/report.pdf",
            "https://example.test/report.pdf"
        );
    });

    it("fails explicitly when the toolbar selection has not been initialized", () => {
        expect(() => insertAssetIntoProtyle("assets/diagram.png", {} as IProtyle))
            .toThrow("Protyle toolbar module is not initialized");
        expect(() => insertAssetIntoProtyle("assets/diagram.png", {toolbar: {}} as IProtyle))
            .toThrow("Protyle toolbar range is not initialized");
        expect(mocks.insertHTML).not.toHaveBeenCalled();
    });
});
