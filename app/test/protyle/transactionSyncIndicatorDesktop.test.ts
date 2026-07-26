import {expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    isPaidUser: vi.fn(),
    needSubscribe: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/lifecycle/imports", () => ({
    isMobile: false,
    isPaidUser: mocks.isPaidUser,
    needSubscribe: mocks.needSubscribe,
}));

import {markTransactionSyncPending} from "../../src/protyle/wysiwyg/transaction/lifecycle/syncIndicator";

it("short-circuits desktop transactions before reading account capabilities", () => {
    markTransactionSyncPending();

    expect(mocks.isPaidUser).not.toHaveBeenCalled();
    expect(mocks.needSubscribe).not.toHaveBeenCalled();
});
