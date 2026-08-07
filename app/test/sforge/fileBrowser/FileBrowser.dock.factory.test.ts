import {beforeEach, describe, expect, it, vi} from "vitest";

const dockSpies = vi.hoisted(() => ({
    customOptions: [] as Record<string, unknown>[],
    mount: vi.fn(),
    unmounts: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("../../../src/sforge/fileBrowser/FileBrowserPanel.vue", () => ({default: {name: "FileBrowserPanel"}}));
vi.mock("../../../src/sforge/fileBrowser/FilePropertiesPanel.vue", () => ({default: {name: "FilePropertiesPanel"}}));
vi.mock("../../../src/sforge/fileBrowser/FileTagTreeDock.vue", () => ({default: {name: "FileTagTreeDock"}}));
vi.mock("../../../src/sforge/fileBrowser/FileBrowser.preview", () => ({registerFileBrowserPreviewTab: vi.fn()}));
vi.mock("../../../src/sforge/fileBrowser/dock/imports", () => ({
    Custom: class {
        constructor(options: Record<string, unknown>) {
            dockSpies.customOptions.push(options);
        }
    },
    createVueComponentLoader: vi.fn((...args: unknown[]) => {
        dockSpies.mount(...args);
        const unmount = vi.fn();
        dockSpies.unmounts.push(unmount);
        return {unmount};
    }),
    isHTMLElement: vi.fn(() => true),
}));

import {
    createFileBrowserDockModel,
    createFilePropertiesDockModel,
    createFileTagTreeDockModel,
    FILE_BROWSER_DOCK_TYPE,
    FILE_PROPERTIES_DOCK_TYPE,
    FILE_TAG_TREE_DOCK_TYPE,
} from "../../../src/sforge/fileBrowser/init";

describe("file browser Dock factory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dockSpies.customOptions.length = 0;
        dockSpies.unmounts.length = 0;
    });

    it("uses the existing Custom lifecycle for Vue mount and disposal", () => {
        createFileBrowserDockModel({} as never, {} as never);

        const options = dockSpies.customOptions[0];
        expect(options?.type).toBe(FILE_BROWSER_DOCK_TYPE);
        const classList = {add: vi.fn()};
        const custom = {element: {classList}, destroy: undefined as (() => void) | undefined};
        const init = options?.init;
        expect(init).toBeTypeOf("function");
        if (typeof init === "function") {
            init(custom);
        }

        expect(classList.add).toHaveBeenCalledWith("fn__flex-column", "sforge-file-browser-dock");
        expect(dockSpies.mount).toHaveBeenCalledOnce();
        custom.destroy?.();
        expect(dockSpies.unmounts[0]).toHaveBeenCalledOnce();
    });

    it("disposes the browser and properties Vue instances independently", () => {
        createFileBrowserDockModel({} as never, {} as never);
        createFilePropertiesDockModel({} as never, {} as never);
        createFileTagTreeDockModel({} as never, {} as never);

        expect(dockSpies.customOptions.map(options => options.type)).toEqual([
            FILE_BROWSER_DOCK_TYPE,
            FILE_PROPERTIES_DOCK_TYPE,
            FILE_TAG_TREE_DOCK_TYPE,
        ]);
        const browserClassList = {add: vi.fn()};
        const propertiesClassList = {add: vi.fn()};
        const tagsClassList = {add: vi.fn()};
        const browser = {element: {classList: browserClassList}, destroy: undefined as (() => void) | undefined};
        const properties = {element: {classList: propertiesClassList}, destroy: undefined as (() => void) | undefined};
        const tags = {element: {classList: tagsClassList}, destroy: undefined as (() => void) | undefined};
        for (const [index, custom] of [browser, properties, tags].entries()) {
            const init = dockSpies.customOptions[index]?.init;
            expect(init).toBeTypeOf("function");
            if (typeof init === "function") {
                init(custom);
            }
        }

        expect(browserClassList.add).toHaveBeenCalledWith("fn__flex-column", "sforge-file-browser-dock");
        expect(propertiesClassList.add).toHaveBeenCalledWith("fn__flex-column", "sforge-file-properties-dock");
        expect(tagsClassList.add).toHaveBeenCalledWith("fn__flex-column", "sforge-file-tags-dock");
        expect(dockSpies.mount).toHaveBeenCalledTimes(3);
        browser.destroy?.();
        expect(dockSpies.unmounts[0]).toHaveBeenCalledOnce();
        expect(dockSpies.unmounts[1]).not.toHaveBeenCalled();
        properties.destroy?.();
        expect(dockSpies.unmounts[1]).toHaveBeenCalledOnce();
        expect(dockSpies.unmounts[2]).not.toHaveBeenCalled();
        tags.destroy?.();
        expect(dockSpies.unmounts[2]).toHaveBeenCalledOnce();
    });
});
