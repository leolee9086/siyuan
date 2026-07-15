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
});
