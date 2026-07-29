import {beforeEach, describe, expect, it, vi} from "vitest";
import {SYSTEM_WINDOW_KEY_COMMANDS} from "../../../src/boot/globalEvent/keydown/windowKeyDown/commands.types";
import {routeWindowKeyDown} from "../../../src/boot/globalEvent/keydown/windowKeyDown/route";
import {routeSystemWindowKeyCommand} from "../../../src/boot/globalEvent/keydown/windowKeyDown/route/system";

const escapeDependencies = vi.hoisted(() => ({
    dialogs: [] as Array<{destroy: () => void}>,
    cancelDrag: vi.fn(),
    focusBlock: vi.fn(),
    focusByRange: vi.fn(),
}));

vi.mock("../../../src/boot/globalEvent/keydown/windowKeyDown/subset/imports", () => ({
    cancelDrag: escapeDependencies.cancelDrag,
    focusBlock: escapeDependencies.focusBlock,
    focusByRange: escapeDependencies.focusByRange,
    getAllModels: () => ({editor: []}),
    getSiyuanBackStack: () => [],
    getSiyuanBlockPanels: () => [],
    getSiyuanDialogs: () => escapeDependencies.dialogs,
    getSiyuanMenus: () => ({
        menu: {
            element: Object.assign(document.createElement("div"), {className: "fn__none"}),
            remove: vi.fn(),
        },
    }),
    hasClosestBlock: () => undefined,
    hasClosestByClassName: () => undefined,
}));

const createSystemRouteState = (isComposing = false) => ({
    isTabWindow: false,
    dockHotkeyType: null,
    system: {
        isElectron: false,
        targetInPdf: false,
        targetIsTextInput: false,
        isReadonlyConfig: false,
        zoomInHotkey: false,
        zoomRestoreHotkey: false,
        zoomOutHotkey: false,
        syncNowHotkey: false,
        commandPanelHotkey: false,
        toggleReadonlyHotkey: false,
        lockScreenHotkey: false,
        openHistoryHotkey: false,
        toggleDockBarHotkey: false,
        openSettingHotkey: false,
        preventSelectAllHotkey: false,
        openRiffCardHotkey: false,
        openDailyNoteHotkey: false,
        newFileHotkey: false,
        hasConfirmDialog: false,
        isEnterKey: false,
        isEscapeKey: true,
        isComposing,
    },
});

const createRootEscapeRouteState = () => ({
    ...createSystemRouteState(),
    specialDialogType: null,
    dialog: {
        hasSwitchDialog: false,
        switchDialogMounted: false,
        isArrowKey: false,
        pressedDialogHotkey: null,
        isArrowOrEnterWithoutModifiers: false,
        hasRecentDocsDialog: false,
        hasSpecialDialog: false,
    },
    ui: {
        menuVisible: false,
        menuHandledKey: false,
        hasModifierKey: false,
        targetInMenuTextInput: false,
        avPanelVisible: false,
        avPanelHandledKey: true,
        avPanelHasRollupSearchMenu: false,
        avPanelHasExistingAssetMenu: false,
    },
    navigation: {
        pressedNavigationHotkey: null,
        replaceHotkey: false,
        globalSearchHotkey: false,
        searchHotkey: false,
        saveHotkey: false,
    },
});

describe("Dialog Escape routing", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        escapeDependencies.dialogs.length = 0;
        escapeDependencies.cancelDrag.mockClear();
    });

    it("routes a non-composing Escape key to the system escape command", () => {
        expect(routeSystemWindowKeyCommand(createSystemRouteState())).toBe(SYSTEM_WINDOW_KEY_COMMANDS.ESCAPE);
        expect(routeSystemWindowKeyCommand(createSystemRouteState(true))).toBe(SYSTEM_WINDOW_KEY_COMMANDS.IGNORE);
    });

    it("keeps Escape in the system domain when no menu or specialized dialog handles it", () => {
        const routed = routeWindowKeyDown(createRootEscapeRouteState());

        expect(routed.domain).toBe("system");
        expect(routed.resolvedCommands.systemCommand).toBe(SYSTEM_WINDOW_KEY_COMMANDS.ESCAPE);
    });

    it("destroys the top registered dialog", async () => {
        const destroyBottom = vi.fn();
        const destroyTop = vi.fn();
        escapeDependencies.dialogs.push({destroy: destroyBottom}, {destroy: destroyTop});
        const event = new KeyboardEvent("keydown", {key: "Escape"});
        const {executeEscape} = await import("../../../src/boot/globalEvent/keydown/windowKeyDown/subset/system.escape");

        const handled = executeEscape({event} as Parameters<typeof executeEscape>[0]);

        expect(handled).toBe(true);
        expect(escapeDependencies.cancelDrag).toHaveBeenCalledOnce();
        expect(destroyTop).toHaveBeenCalledOnce();
        expect(destroyBottom).not.toHaveBeenCalled();
    });
});
