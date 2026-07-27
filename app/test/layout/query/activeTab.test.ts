import {beforeEach, describe, expect, it, vi} from "vitest";

const querySpies = vi.hoisted(() => ({getAllTabs: vi.fn()}));

vi.mock("../../../src/layout/query/activeTab/imports", () => ({getAllTabs: querySpies.getAllTabs}));

const createTab = (id: string, focused: boolean) => ({
    id,
    headElement: {classList: {contains: vi.fn(() => focused)}},
});

describe("active tab query", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = "";
    });

    it("resolves the tab identified by the active window DOM marker", async () => {
        const tab = createTab("tab-1", true);
        querySpies.getAllTabs.mockReturnValue([tab]);
        document.body.innerHTML = '<div class="layout__wnd--active"><div class="item--focus" data-id="tab-1"></div></div>';

        const {getActiveTab} = await import("../../../src/layout/query/activeTab");

        expect(getActiveTab()).toBe(tab);
    });

    it("uses the focused layout tab only when the caller permits a fallback", async () => {
        const tab = createTab("tab-2", true);
        querySpies.getAllTabs.mockReturnValue([tab]);
        const {getActiveTab} = await import("../../../src/layout/query/activeTab");

        expect(getActiveTab()).toBeUndefined();
        expect(getActiveTab(false)).toBe(tab);
    });
});
