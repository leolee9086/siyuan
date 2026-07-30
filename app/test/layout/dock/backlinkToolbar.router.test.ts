import {describe, expect, it, vi} from "vitest";
import type {EventBus} from "siyuan";
import {
    reportBacklinkUserOperationIntent,
} from "../../../src/layout/dock/backlink/backlinkOperationIntent";
import {resolveBacklinkToolbarCommand} from "../../../src/layout/dock/backlink/backlinkToolbar.router";

describe("Backlink toolbar state router", () => {
    it("routes every supported toolbar control from its presentation state", () => {
        expect(resolveBacklinkToolbarCommand("refresh", "pin")).toEqual({kind: "refresh"});
        expect(resolveBacklinkToolbarCommand("mExpand", "local")).toEqual({kind: "expand-mentions"});
        expect(resolveBacklinkToolbarCommand("mCollapse", "bottom")).toEqual({kind: "collapse-mentions"});
        expect(resolveBacklinkToolbarCommand("min", "pin")).toEqual({kind: "minimize"});
        expect(resolveBacklinkToolbarCommand("min", "bottom")).toEqual({kind: "ignore"});
        expect(resolveBacklinkToolbarCommand("search", "bottom")).toEqual({kind: "show-filter"});
        expect(resolveBacklinkToolbarCommand("sort", "pin")).toEqual({kind: "show-sort", sortTarget: "sort"});
        expect(resolveBacklinkToolbarCommand("mSort", "bottom")).toEqual({kind: "show-sort", sortTarget: "mSort"});
        expect(resolveBacklinkToolbarCommand("layout", "pin")).toEqual({kind: "cycle-mention-layout", layoutTarget: "layout"});
        expect(resolveBacklinkToolbarCommand("mention", "bottom")).toEqual({kind: "cycle-mention-layout", layoutTarget: "mention"});
        expect(resolveBacklinkToolbarCommand("unknown-control", "local")).toEqual({kind: "ignore"});
    });

    it("reports only content-free user intent through the official plugin event bus", () => {
        const eventBus: EventBus = {
            emit: vi.fn(),
            off: vi.fn(),
            on: vi.fn(),
            once: vi.fn(),
        };
        const app = {plugins: [{eventBus}]};
        reportBacklinkUserOperationIntent(app, {
            actor: "user",
            surface: "backlink",
            presentation: "bottom",
            source: "toolbar",
            operation: "refresh",
            trigger: "click",
            blockId: "20260731000000-abcdefg",
        });

        expect(eventBus.emit).toHaveBeenCalledWith("user-backlink-operation-intent", {
            intent: expect.objectContaining({
                actor: "user",
                presentation: "bottom",
                operation: "refresh",
                blockId: "20260731000000-abcdefg",
            }),
        });
    });
});
