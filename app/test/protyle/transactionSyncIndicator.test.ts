import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    isPaidUser: vi.fn(),
    needSubscribe: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/lifecycle/imports", () => ({
    isMobile: true,
    isPaidUser: mocks.isPaidUser,
    needSubscribe: mocks.needSubscribe,
}));

import {markTransactionSyncPending} from "../../src/protyle/wysiwyg/transaction/lifecycle/syncIndicator";

const setSyncConfig = (provider: number, enabled = true, key = "repo-key") => {
    window.siyuan = {
        config: {sync: {provider, enabled}, repo: {key}},
    } as Window["siyuan"];
};

describe("transaction sync indicator", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '<div id="toolbarSync" class="fn__none"></div>';
    });

    it("shows pending sync for a paid official-provider user", () => {
        setSyncConfig(1);
        mocks.isPaidUser.mockReturnValue(true);

        markTransactionSyncPending();

        expect(document.getElementById("toolbarSync").classList.contains("fn__none")).toBe(false);
    });

    it("shows pending sync for an eligible third-party provider", () => {
        setSyncConfig(0);
        mocks.needSubscribe.mockReturnValue(false);

        markTransactionSyncPending();

        expect(mocks.needSubscribe).toHaveBeenCalledWith("");
        expect(document.getElementById("toolbarSync").classList.contains("fn__none")).toBe(false);
    });

    it("keeps the indicator hidden when synchronization is disabled", () => {
        setSyncConfig(1, false);
        mocks.isPaidUser.mockReturnValue(true);

        markTransactionSyncPending();

        expect(document.getElementById("toolbarSync").classList.contains("fn__none")).toBe(true);
    });

    it("fails explicitly when an eligible mobile host lacks the sync indicator", () => {
        setSyncConfig(1);
        mocks.isPaidUser.mockReturnValue(true);
        document.body.innerHTML = "";

        expect(() => markTransactionSyncPending())
            .toThrow("Transaction sync indicator requires #toolbarSync");
    });
});
