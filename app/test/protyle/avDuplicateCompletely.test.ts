import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    avRender: vi.fn(),
    fetchPost: vi.fn(),
    focusBlock: vi.fn(),
    scrollCenter: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../src/protyle/render/av/action/imports", () => ({
    avRender: mocks.avRender,
    Constants: {
        CUSTOM_SY_AV_VIEW: "custom-sy-av-view",
        CUSTOM_SY_AV_VISIBLE_VIEWS: "custom-sy-av-visible-views",
    },
    fetchPost: mocks.fetchPost,
    focusBlock: mocks.focusBlock,
    isHTMLElement: (value: unknown) => value instanceof HTMLElement,
    scrollCenter: mocks.scrollCenter,
    transaction: mocks.transaction,
}));

import {duplicateCompletely} from "../../src/protyle/render/av/action/duplicate";

describe("duplicateCompletely", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = "";
        mocks.fetchPost.mockImplementation((_url, _body, callback) => {
            callback({data: {avID: "new-av", blockID: "new-block"}});
        });
    });

    it("preserves view metadata and renders only after the insert transaction callback", () => {
        const source = document.createElement("div");
        source.className = "av protyle-wysiwyg--select";
        source.dataset.nodeId = "source-block";
        source.dataset.avId = "source-av";
        source.dataset.avType = "gallery";
        source.setAttribute("custom-sy-av-view", "view-2");
        source.setAttribute("custom-sy-av-visible-views", "view-1,view-2");
        document.body.append(source);
        const protyle = {
            lute: {
                SpinBlockDOM: (html: string) => html,
            },
        } as IProtyle;

        duplicateCompletely(protyle, source);

        expect(mocks.fetchPost).toHaveBeenCalledWith(
            "/api/av/duplicateAttributeViewBlock",
            {avID: "source-av"},
            expect.any(Function),
        );
        const duplicate = source.nextElementSibling as HTMLElement;
        expect(duplicate.dataset.avId).toBe("new-av");
        expect(duplicate.dataset.avType).toBe("gallery");
        expect(duplicate.getAttribute("custom-sy-av-view")).toBe("view-2");
        expect(duplicate.getAttribute("custom-sy-av-visible-views")).toBe("view-1,view-2");
        expect(duplicate.dataset.render).toBe("true");
        expect(mocks.avRender).not.toHaveBeenCalled();

        const transactionCall = mocks.transaction.mock.calls[0];
        expect(transactionCall[1]).toEqual([{
            action: "insert",
            data: expect.not.stringContaining("data-render"),
            id: "new-block",
            previousID: "source-block",
        }]);
        transactionCall[3].callback();
        expect(duplicate.hasAttribute("data-render")).toBe(false);
        expect(mocks.avRender).toHaveBeenCalledWith(duplicate, protyle, expect.any(Function));

        mocks.avRender.mock.calls[0][2]();
        expect(mocks.focusBlock).toHaveBeenCalledWith(duplicate);
        expect(mocks.scrollCenter).toHaveBeenCalledWith(protyle);
    });
});
