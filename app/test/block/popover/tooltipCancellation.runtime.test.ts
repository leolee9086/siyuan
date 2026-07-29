import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    fetchPost: vi.fn(),
    showTooltip: vi.fn(),
}));

vi.mock("../../../src/block/popover/imports", () => ({
    Constants: {},
    Editor: class Editor {},
    Tab: class Tab {},
    escapeAriaLabel: (value: string) => value,
    escapeHtml: (value: string) => value,
    escapeLessThans: (value: string) => value,
    fetchPost: runtime.fetchPost,
    getCellText: () => "",
    getDOMPurify: () => ({sanitize: (value: string) => value}),
    getInstanceById: () => undefined,
    getSiyuanIsPublish: () => false,
    hasClosestByClassName: () => null,
    isLocalPath: () => true,
    showTooltip: runtime.showTooltip,
    siyuanI18n: {createdAt: "created", modifiedAt: "modified"},
}));

import {
    abortPendingTooltipRequest,
    handleTooltipDisplay,
} from "../../../src/block/popover/tooltip";

type FetchCallback = (response: IWebSocketData) => void;

const getFetchCallback = (callIndex: number) => {
    const call = runtime.fetchPost.mock.calls[callIndex];
    if (!call || typeof call[2] !== "function") {
        throw new Error(`Tooltip request ${callIndex} did not register a response callback`);
    }
    return call[2] as FetchCallback;
};

describe("tooltip request cancellation", () => {
    beforeEach(() => {
        abortPendingTooltipRequest();
        runtime.fetchPost.mockReset();
        runtime.showTooltip.mockReset();
    });

    it("invalidates stale results without aborting the underlying fetch", () => {
        const link = document.createElement("a");
        link.setAttribute("data-href", "file:///workspace/asset.png");
        const event = new MouseEvent("mouseover");

        expect(handleTooltipDisplay(link, event, {
            tip: "asset.png",
            tooltipClass: "asset-tip",
        })).toBe(true);
        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/asset/statAsset",
            {path: "file:///workspace/asset.png"},
            expect.any(Function),
        );
        expect(runtime.fetchPost.mock.calls[0]).toHaveLength(3);

        const staleCallback = getFetchCallback(0);
        abortPendingTooltipRequest();
        staleCallback({
            code: 0,
            msg: "",
            data: {hCreated: "now", hSize: "1 KB", hUpdated: "now"},
        });
        expect(runtime.showTooltip).not.toHaveBeenCalled();

        handleTooltipDisplay(link, event, {
            tip: "asset.png",
            tooltipClass: "asset-tip",
        });
        getFetchCallback(1)({
            code: 0,
            msg: "",
            data: {hCreated: "now", hSize: "1 KB", hUpdated: "now"},
        });
        expect(runtime.showTooltip).toHaveBeenCalledOnce();
    });
});
