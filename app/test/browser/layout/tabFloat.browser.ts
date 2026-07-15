import {afterEach, describe, expect, it, vi} from "vitest";
import type {Tab} from "../../../src/layout/Tab";
import {
    requestOpenTabAsDialog,
    resetLayoutTabFloatPort,
    setLayoutTabFloatPort,
    subscribeTabFloatRequest,
} from "../../../src/layout/tabFloat.port";

const makeTab = (id = "tab-1", title = "Test tab") => ({id, title} as Tab);

afterEach(() => {
    resetLayoutTabFloatPort();
});

describe("Layout tab Dialog float capability", () => {
    it("emits a validated request when the host has no float port", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTabFloatRequest(listener);

        expect(requestOpenTabAsDialog(makeTab())).toBe(true);
        expect(listener).toHaveBeenCalledWith({
            tabId: "tab-1",
            title: "Test tab",
            source: "tab-menu",
        });

        unsubscribe();
    });

    it("forwards the opaque Tab handle to a registered host", () => {
        const tab = makeTab();
        const open = vi.fn(() => true);
        setLayoutTabFloatPort({open});

        expect(requestOpenTabAsDialog(tab)).toBe(true);
        expect(open).toHaveBeenCalledWith(tab);
    });

    it("falls back to the typed request event when a host declines", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTabFloatRequest(listener);
        setLayoutTabFloatPort({open: () => false});

        expect(requestOpenTabAsDialog(makeTab("tab-2", "Declined tab"))).toBe(true);
        expect(listener).toHaveBeenCalledWith({
            tabId: "tab-2",
            title: "Declined tab",
            source: "tab-menu",
        });

        unsubscribe();
    });
});
