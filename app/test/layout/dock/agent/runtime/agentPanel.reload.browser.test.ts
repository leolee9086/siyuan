import {afterEach, describe, expect, it, vi} from "vitest";
import {createBrowserHostReload} from "../../../../../src/layout/dock/agent/runtime/host/agentPanel.reload.browser.factory";

describe("Agent Panel browser reload capability", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("reloads immediately after the caller has posted the tool result", () => {
        const reload = vi.fn();
        vi.stubGlobal("location", {reload});

        const reloadHost = createBrowserHostReload();
        reloadHost();

        expect(reload).toHaveBeenCalledOnce();
    });
});
