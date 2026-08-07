import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../src/protyle", () => ({Protyle: class {}}));
vi.mock("../../../src/layout/getAll", () => ({getAllModels: () => ({editor: []})}));
vi.mock("../../../src/layout/query/dockByType", () => ({getDockByType: vi.fn()}));
vi.mock("../../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {tag: "Tags"},
}));
vi.mock("../../../src/util/siyuanEnvironments/forgeI18n.getI18n.environment", () => ({
    forgeI18n: {embedding: "Embeddings", forwardlinks: "Forward links"},
}));

import {BUILTIN_DOCK_TYPES} from "../../../src/layout/dock/dock.builtin";
import {isTDock} from "../../../src/layout/dock/dock.guard";
import {initDockData} from "../../../src/layout/dock/dock.init";
import {getAllRegisteredTypes, resetRegistry} from "../../../src/layout/dock/dock.registry";
import type {DockDomain} from "../../../src/layout/dock/dock.types";
import {
    createFileBrowserDockLayoutItem,
    FILE_BROWSER_DOCK_DEFINITIONS,
    FILE_BROWSER_DOCK_TYPES,
} from "../../../src/sforge/fileBrowser/FileBrowser.docks";

function layoutItem(type: string): Config.IUILayoutDockTab {
    return {
        type,
        icon: "iconFile",
        title: type,
        size: {width: 200, height: 0},
        show: false,
        hotkey: "",
        hotkeyLangId: "",
    };
}

function createDock(position: TDockPosition): DockDomain {
    const shell = document.createElement("div");
    const first = document.createElement("div");
    const second = document.createElement("div");
    shell.append(first, second);
    return {
        app: {} as never,
        elements: [first, second],
        layout: {children: [], element: document.createElement("div")} as never,
        position,
        resizeElement: document.createElement("div"),
        pin: true,
        data: {},
        hideResizeTimeout: 0,
        resetDockPosition: vi.fn(),
        togglePin: vi.fn(),
        showDock: vi.fn(),
        hideDock: vi.fn(),
        toggleModel: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        setSize: vi.fn(),
        genButton: vi.fn(),
        addCustomItem: vi.fn(),
        saveLocalPlugin: vi.fn(),
    };
}

function countFileBrowserTypes(data: Config.IUILayoutDockTab[][]) {
    return data.flat().filter(item => FILE_BROWSER_DOCK_TYPES.includes(item.type as never)).map(item => item.type);
}

describe("file browser Dock layout recovery", () => {
    beforeEach(() => {
        resetRegistry();
    });

    it("restores both missing types to their declared columns with the complete layout template", () => {
        const data: Config.IUILayoutDockTab[][] = [[layoutItem("file")], [layoutItem("bookmark")]];
        const dock = createDock("Left");

        initDockData(dock, data, [...BUILTIN_DOCK_TYPES]);

        for (const definition of FILE_BROWSER_DOCK_DEFINITIONS) {
            const restored = data[definition.column]?.find(item => item.type === definition.type);
            expect(restored).toEqual(createFileBrowserDockLayoutItem(definition));
            expect(restored?.size).not.toBe(definition.size);
            expect(isTDock(restored?.type)).toBe(true);
        }
        expect(dock.genButton).toHaveBeenCalledWith(data[0], 0);
        expect(dock.genButton).toHaveBeenCalledWith(data[1], 1);
    });

    it("keeps the first persisted occurrence and removes same-position duplicates across columns", () => {
        const browser = createFileBrowserDockLayoutItem(FILE_BROWSER_DOCK_DEFINITIONS[0]);
        const properties = createFileBrowserDockLayoutItem(FILE_BROWSER_DOCK_DEFINITIONS[1]);
        const data: Config.IUILayoutDockTab[][] = [
            [{...browser, size: {...browser.size}}, {...browser, size: {...browser.size}}],
            [{...browser, size: {...browser.size}}, {...properties, size: {...properties.size}}, {...properties, size: {...properties.size}}],
        ];

        initDockData(createDock("Left"), data, [...BUILTIN_DOCK_TYPES]);

        expect(countFileBrowserTypes(data)).toEqual([browser.type, properties.type]);
        expect(data[0]?.filter(item => item.type === browser.type)).toHaveLength(1);
        expect(data[1]?.filter(item => item.type === properties.type)).toHaveLength(1);
    });

    it("uses production initialization order to reject stale copies from another Dock position", () => {
        const leftData: Config.IUILayoutDockTab[][] = [[], []];
        initDockData(createDock("Left"), leftData, [...BUILTIN_DOCK_TYPES]);
        const rightData: Config.IUILayoutDockTab[][] = [
            FILE_BROWSER_DOCK_DEFINITIONS.map(definition => createFileBrowserDockLayoutItem(definition)),
            [],
        ];

        initDockData(createDock("Right"), rightData, [...BUILTIN_DOCK_TYPES]);

        expect(countFileBrowserTypes(leftData)).toEqual([...FILE_BROWSER_DOCK_TYPES]);
        expect(countFileBrowserTypes(rightData)).toEqual([]);
        for (const type of FILE_BROWSER_DOCK_TYPES) {
            expect(getAllRegisteredTypes().get(type)).toBe("Left");
        }
    });
});
