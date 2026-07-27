import {beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";

const mocks = vi.hoisted(() => ({
    openBlock: vi.fn(),
}));

vi.mock("../../src/platform", () => ({isElectron: false, isMobile: false}));
vi.mock("../../src/util/network/fetch", () => ({fetchPost: vi.fn()}));
vi.mock("../../src/util/file/pathName", () => ({originalPath: vi.fn(), useShell: vi.fn()}));
vi.mock("../../src/constants", () => ({
    Constants: {CB_GET_FOCUS: "focus", CB_GET_SCROLL: "scroll"},
}));
vi.mock("../../src/window/openNewWindow", () => ({openNewWindowById: vi.fn()}));
vi.mock("../../src/menus/Menu.Item", () => ({
    MenuItem: class {
        public element = document.createElement("button");
    },
}));
vi.mock("../../src/protyle/util/compatibility", () => ({updateHotkeyTip: (value: string) => value}));
vi.mock("../../src/block/fold/checkFold", () => ({
    checkFold: (_id: string, callback: (zoomIn: boolean, action: TProtyleAction[]) => void) => {
        callback(true, []);
    },
}));
vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {
        click: "Click",
        insertRight: "Right",
        insertBottom: "Bottom",
        openInNewTab: "New tab",
        openByNewWindow: "New window",
        preview: "Preview",
        showInFolder: "Show in folder",
        openBy: "Open by",
    },
}));
vi.mock("../../src/export-preview/open", () => ({openExportPreviewTab: vi.fn()}));

import {openEditorTab} from "../../src/menus/util";

const click = (item: IMenu | undefined) => {
    if (!item?.click) {
        throw new Error("Expected editor tab menu click action");
    }
    item.click(document.createElement("button"), new MouseEvent("click"));
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {
                fileTree: {openFilesUseCurrentTab: true},
                keymap: {editor: {general: {insertRight: {custom: "Right key"}}}},
            },
        },
    });
});

describe("openEditorTab", () => {
    it("routes folded documents through the complete app facade", () => {
        const app = createTestAppFacade(mocks.openBlock);
        const items = openEditorTab(app, ["document-id"], undefined, undefined, true);
        if (!items) {
            throw new Error("Expected desktop editor menu items");
        }

        click(items[0]);
        expect(mocks.openBlock).toHaveBeenCalledWith({
            id: "document-id",
            position: "right",
            action: [],
            zoomIn: true,
        });
    });

    it("preserves the notebook new-tab navigation payload", () => {
        const app = createTestAppFacade(mocks.openBlock);
        const items = openEditorTab(app, ["document-id"], "notebook-id", "/document.sy", true);
        if (!items) {
            throw new Error("Expected desktop editor menu items");
        }

        click(items.find(item => item.id === "openInNewTab"));
        expect(mocks.openBlock).toHaveBeenCalledWith({
            id: "document-id",
            action: ["focus", "scroll"],
            removeCurrentTab: false,
        });
    });
});
