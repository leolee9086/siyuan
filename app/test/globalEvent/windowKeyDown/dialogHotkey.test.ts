import {describe, expect, test, vi} from "vitest";
import {findPressedDialogHotkey} from "../../../src/boot/globalEvent/keydown/windowKeyDown/state/dialogHotkey";
import {routeNavigationWindowKeyCommand} from "../../../src/boot/globalEvent/keydown/windowKeyDown/route/navigation";

const createKeyboardEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
}) as KeyboardEvent;

const matchAuxiliaryHotKey = (hotkey: string, event: KeyboardEvent) =>
    hotkey === "⌃⇥" && event.ctrlKey && !event.shiftKey && !event.altKey;

const matchHotKey = (hotkey: string, event: KeyboardEvent) =>
    hotkey === "⌘E" && event.ctrlKey && event.key.toLowerCase() === "e";

const createGeneralKeymap = () => ({
    goToEditTabNext: {custom: "⌃⇥"},
    goToEditTabPrev: {custom: "⌃⇧⇥"},
    recentDocs: {custom: "⌘E"},
});

const createNavigationState = (pressedNavigationHotkey: string) => ({
    isTabWindow: false,
    navigation: {
        pressedNavigationHotkey,
        replaceHotkey: false,
        globalSearchHotkey: false,
        searchHotkey: false,
        saveHotkey: false,
    },
});

const navigationCommands = [
    "mainMenu", "goForward", "goBack", "recentClosed",
    "closeTab", "closeOthers", "closeAll", "closeUnmodified", "closeLeft", "closeRight",
    "goToTab1", "goToTab2", "goToTab3", "goToTab4", "goToTab5", "goToTab6", "goToTab7", "goToTab8", "goToTab9",
    "goToTabNext", "goToTabPrev", "splitLR", "splitMoveR", "splitTB", "tabToWindow", "splitMoveB", "stickSearch",
    "unsplit", "unsplitAll",
];

describe("window keydown shortcut routing", () => {
    test("Ctrl+E is routed to recent documents instead of the tab switch auxiliary path", () => {
        const auxiliaryMatcher = vi.fn(matchAuxiliaryHotKey);
        const result = findPressedDialogHotkey({
            generalKeymap: createGeneralKeymap(),
            event: createKeyboardEvent("e", {ctrlKey: true}),
            matchAuxiliaryHotKey: auxiliaryMatcher,
            matchHotKey,
        });

        expect(result).toBe("openRecentDocs");
        expect(auxiliaryMatcher).not.toHaveBeenCalled();
    });

    test("Ctrl+ArrowUp still uses the tab switch auxiliary path", () => {
        const result = findPressedDialogHotkey({
            generalKeymap: createGeneralKeymap(),
            event: createKeyboardEvent("ArrowUp", {ctrlKey: true}),
            matchAuxiliaryHotKey,
            matchHotKey,
        });

        expect(result).toBe("switchDialogNextAux");
    });

    test("ArrowLeft does not enter the special dialog navigation path", () => {
        const result = findPressedDialogHotkey({
            generalKeymap: createGeneralKeymap(),
            event: createKeyboardEvent("ArrowLeft"),
            matchAuxiliaryHotKey: () => false,
            matchHotKey: () => false,
        });

        expect(result).toBeNull();
    });

    test("recently closed navigation command remains routable", () => {
        const result = routeNavigationWindowKeyCommand(createNavigationState("recentClosed"));

        expect(result).toBe("recentClosed");
    });

    test.each(navigationCommands)("routes %s to its command executor", (command) => {
        expect(routeNavigationWindowKeyCommand(createNavigationState(command))).toBe(command);
    });
});
