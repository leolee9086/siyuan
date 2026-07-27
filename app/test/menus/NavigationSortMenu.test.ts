import {after, describe, it} from "node:test";
import {strict as assert} from "node:assert";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
        siyuan: {
            config: {lang: "test"},
            languages: {
                fileNameASC: "fileNameASC",
                fileNameDESC: "fileNameDESC",
                fileNameNatASC: "fileNameNatASC",
                fileNameNatDESC: "fileNameNatDESC",
                createdASC: "createdASC",
                createdDESC: "createdDESC",
                modifiedASC: "modifiedASC",
                modifiedDESC: "modifiedDESC",
                refCountASC: "refCountASC",
                refCountDESC: "refCountDESC",
                docSizeASC: "docSizeASC",
                docSizeDESC: "docSizeDESC",
                subDocCountASC: "subDocCountASC",
                subDocCountDESC: "subDocCountDESC",
                customSort: "customSort",
                sortByFiletree: "sortByFiletree",
            },
        },
    },
});

const sortMenuModule = import("../../src/menus/navigation/sortMenu");

after(() => {
    if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
        return;
    }
    Reflect.deleteProperty(globalThis, "window");
});

describe("navigation sort menu", () => {
    it("preserves the complete global ordering and selected mode", async () => {
        const {sortMenu} = await sortMenuModule;
        const menu = sortMenu("notebooks", 10, () => undefined);
        assert.deepEqual(menu.map((item) => item.id), [
            "fileNameASC", "fileNameDESC", "fileNameNatASC", "fileNameNatDESC", "separator_1",
            "createdASC", "createdDESC", "modifiedASC", "modifiedDESC", "separator_2",
            "refCountASC", "refCountDESC", "separator_3", "docSizeASC", "docSizeDESC",
            "separator_4", "subDocCountASC", "subDocCountDESC", "separator_5", "customSort",
        ]);
        assert.equal(menu.find((item) => item.id === "createdDESC")?.checked, true);
        assert.equal(menu.find((item) => item.id === "createdDESC")?.icon, "iconSelect");
        assert.equal(menu.find((item) => item.id === "fileNameASC")?.icon, undefined);
    });

    it("adds file-tree inheritance only for a single notebook and dispatches its mode", async () => {
        const {sortMenu} = await sortMenuModule;
        const selectedModes: number[] = [];
        const menu = sortMenu("notebook", 15, (mode) => selectedModes.push(mode));
        const inheritanceItem = menu.at(-1);
        assert.equal(inheritanceItem?.id, "sortByFiletree");
        assert.equal(inheritanceItem?.checked, true);
        assert.ok(inheritanceItem?.click);
        Reflect.apply(inheritanceItem.click, undefined, [{}, {}]);
        assert.deepEqual(selectedModes, [15]);
    });
});
