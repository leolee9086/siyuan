import { expect, it } from "vitest";
import { effectCalibur, effectState } from "../src/effect.js";

const navigationState = effectState.object({
    isTabWindow: effectState.boolean(),
    navigation: effectState.object({
        pressedNavigationHotkey: effectState.union(effectState.string(), effectState.literal(null)),
        replaceHotkey: effectState.boolean(),
        globalSearchHotkey: effectState.boolean(),
        searchHotkey: effectState.boolean(),
        saveHotkey: effectState.boolean(),
    }),
});

const hotkey = <const Key extends string>(key: Key) => effectState.object({
    navigation: effectState.object({ pressedNavigationHotkey: effectState.literal(key) }),
});

export const longEffectNavigationRouter = effectCalibur
    .universe(navigationState)
    .split(effectState.object({ isTabWindow: effectState.literal(false), navigation: effectState.object({
        pressedNavigationHotkey: effectState.literal("mainMenu"),
    }) }), () => "mainMenu" as const)
    .split(hotkey("goForward"), () => "goForward" as const)
    .split(hotkey("goBack"), () => "goBack" as const)
    .split(hotkey("recentClosed"), () => "recentClosed" as const)
    .split(hotkey("closeTab"), () => "closeTab" as const)
    .split(hotkey("closeOthers"), () => "closeOthers" as const)
    .split(hotkey("closeAll"), () => "closeAll" as const)
    .split(hotkey("closeUnmodified"), () => "closeUnmodified" as const)
    .split(hotkey("closeLeft"), () => "closeLeft" as const)
    .split(hotkey("closeRight"), () => "closeRight" as const)
    .split(hotkey("goToTab1"), () => "goToTab1" as const)
    .split(hotkey("goToTab2"), () => "goToTab2" as const)
    .split(hotkey("goToTab3"), () => "goToTab3" as const)
    .split(hotkey("goToTab4"), () => "goToTab4" as const)
    .split(hotkey("goToTab5"), () => "goToTab5" as const)
    .split(hotkey("goToTab6"), () => "goToTab6" as const)
    .split(hotkey("goToTab7"), () => "goToTab7" as const)
    .split(hotkey("goToTab8"), () => "goToTab8" as const)
    .split(hotkey("goToTab9"), () => "goToTab9" as const)
    .split(hotkey("goToTabNext"), () => "goToTabNext" as const)
    .split(hotkey("goToTabPrev"), () => "goToTabPrev" as const)
    .split(hotkey("splitLR"), () => "splitLR" as const)
    .split(hotkey("splitMoveR"), () => "splitMoveR" as const)
    .split(hotkey("splitTB"), () => "splitTB" as const)
    .split(hotkey("tabToWindow"), () => "tabToWindow" as const)
    .split(hotkey("splitMoveB"), () => "splitMoveB" as const)
    .split(hotkey("stickSearch"), () => "stickSearch" as const)
    .split(hotkey("unsplit"), () => "unsplit" as const)
    .split(hotkey("unsplitAll"), () => "unsplitAll" as const)
    .otherwise(() => "delegated" as const)
    .build();

it("Effect Schema 长链保持分支语义", () => {
    expect(longEffectNavigationRouter({
        isTabWindow: true,
        navigation: {
            pressedNavigationHotkey: "goToTab9",
            replaceHotkey: false,
            globalSearchHotkey: false,
            searchHotkey: false,
            saveHotkey: false,
        },
    })).toBe("goToTab9");
});
