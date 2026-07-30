import {describe, expect, it} from "vitest";
import {createLinkMenuSavePlan, LINK_MENU_SAVE_COMMANDS} from "../../src/menus/protyleMenus/linkMenu/protyle.linkMenu.savePlan";

describe("link menu save plan", () => {
    it("does not create a transaction when no link block changed", () => {
        const plan = createLinkMenuSavePlan("current-block", [{
            blockId: "20260731000000-link",
            previousHTML: "<div>link</div>",
            nextHTML: "<div>link</div>",
        }]);

        expect(plan).toEqual({
            command: LINK_MENU_SAVE_COMMANDS.NO_CHANGE,
            updates: [],
        });
    });

    it("routes a changed current block to the established update transaction path", () => {
        const plan = createLinkMenuSavePlan("current-block", [{
            blockId: "20260731000000-link",
            previousHTML: "<div>before</div>",
            nextHTML: "<div>after</div>",
        }]);

        expect(plan.command).toBe(LINK_MENU_SAVE_COMMANDS.UPDATE_CURRENT_BLOCK);
        expect(plan.updates).toHaveLength(1);
    });

    it("routes changed captured blocks to one atomic multi-block transaction plan", () => {
        const plan = createLinkMenuSavePlan("captured-blocks", [
            {
                blockId: "20260731000000-first",
                previousHTML: "<div>first-before</div>",
                nextHTML: "<div>first-after</div>",
            },
            {
                blockId: "20260731000000-second",
                previousHTML: "<div>second-before</div>",
                nextHTML: "<div>second-after</div>",
            },
        ]);

        expect(plan.command).toBe(LINK_MENU_SAVE_COMMANDS.UPDATE_CAPTURED_BLOCKS);
        expect(plan.updates.map((update) => update.blockId)).toEqual([
            "20260731000000-first",
            "20260731000000-second",
        ]);
    });
});
