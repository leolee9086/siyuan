import {afterEach, describe, expect, it, vi} from "vitest";
import type {Tab} from "../../../src/layout/Tab";
import {
    requestOpenTabAsDialog,
    resetLayoutTabFloatPort,
    setLayoutTabFloatPort,
} from "../../../src/layout/tabFloat.port";

const makeTab = (id = "tab-1", title = "Test tab") => ({id, title} as Tab);

afterEach(() => {
    resetLayoutTabFloatPort();
});

describe("Layout tab Dialog float capability", () => {
    it("returns false when the host has no float port", () => {
        expect(requestOpenTabAsDialog(makeTab())).toBe(false);
    });

    it("forwards the opaque Tab handle to a registered host", () => {
        const tab = makeTab();
        const open = vi.fn(() => true);
        setLayoutTabFloatPort({open});

        expect(requestOpenTabAsDialog(tab)).toBe(true);
        expect(open).toHaveBeenCalledWith(tab);
    });

    it("returns false when a registered host declines", () => {
        const open = vi.fn(() => false);
        setLayoutTabFloatPort({open});

        expect(requestOpenTabAsDialog(makeTab("tab-2", "Declined tab"))).toBe(false);
        expect(open).toHaveBeenCalledTimes(1);
    });
});
