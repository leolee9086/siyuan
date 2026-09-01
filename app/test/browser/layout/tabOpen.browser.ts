import {afterEach, describe, expect, it, vi} from "vitest";
import type {Tab} from "../../../src/layout/Tab";
import {
    requestOpenTabAsTab,
    resetLayoutTabOpenPort,
    setLayoutTabOpenPort,
    subscribeTabOpenRequest,
} from "../../../src/layout/tabOpen.port";

const makeTab = (id = "agent-tab-1", title = "Agent") => ({id, title} as Tab);

afterEach(() => {
    resetLayoutTabOpenPort();
});

describe("Layout normal Tab open capability", () => {
    it("emits a validated request when no host is registered", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTabOpenRequest(listener);

        expect(requestOpenTabAsTab(makeTab())).toBe(true);
        expect(listener).toHaveBeenCalledWith({
            tabId: "agent-tab-1",
            title: "Agent",
            dockType: "agentChat",
            source: "agent-dock",
        });

        unsubscribe();
    });

    it("forwards the source Tab, menu source, and copy mode to the host", () => {
        const tab = makeTab();
        const open = vi.fn(() => true);
        setLayoutTabOpenPort({open});

        expect(requestOpenTabAsTab(tab, "dock-menu")).toBe(true);
        expect(open).toHaveBeenCalledWith(tab, "dock-menu", "copy");
    });

    it("forwards an explicit new-session mode to the host", () => {
        const tab = makeTab();
        const open = vi.fn(() => true);
        setLayoutTabOpenPort({open});

        expect(requestOpenTabAsTab(tab, "dock-menu", "new")).toBe(true);
        expect(open).toHaveBeenCalledWith(tab, "dock-menu", "new");
    });

    it("falls back to the typed event when the host declines", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTabOpenRequest(listener);
        setLayoutTabOpenPort({open: () => false});

        expect(requestOpenTabAsTab(makeTab("agent-tab-2", "Declined"))).toBe(true);
        expect(listener).toHaveBeenCalledWith({
            tabId: "agent-tab-2",
            title: "Declined",
            dockType: "agentChat",
            source: "agent-dock",
        });

        unsubscribe();
    });
});
