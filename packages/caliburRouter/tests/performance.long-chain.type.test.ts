import {type} from "arktype";
import {expect, it} from "vitest";
import {calibur} from "../src/index.js";

const navigationState = type({
    isTabWindow: "boolean",
    navigation: {
        pressedNavigationHotkey: "string | null",
        replaceHotkey: "boolean",
        globalSearchHotkey: "boolean",
        searchHotkey: "boolean",
        saveHotkey: "boolean",
    },
});

export const longNavigationRouter = calibur
    .universe(navigationState)
    .split(type({isTabWindow: "false", navigation: {pressedNavigationHotkey: "'mainMenu'"}}), () => "mainMenu" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goForward'"}}), () => "goForward" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goBack'"}}), () => "goBack" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'recentClosed'"}}), () => "recentClosed" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeTab'"}}), () => "closeTab" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeOthers'"}}), () => "closeOthers" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeAll'"}}), () => "closeAll" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeUnmodified'"}}), () => "closeUnmodified" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeLeft'"}}), () => "closeLeft" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'closeRight'"}}), () => "closeRight" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab1'"}}), () => "goToTab1" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab2'"}}), () => "goToTab2" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab3'"}}), () => "goToTab3" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab4'"}}), () => "goToTab4" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab5'"}}), () => "goToTab5" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab6'"}}), () => "goToTab6" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab7'"}}), () => "goToTab7" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab8'"}}), () => "goToTab8" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTab9'"}}), () => "goToTab9" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTabNext'"}}), () => "goToTabNext" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'goToTabPrev'"}}), () => "goToTabPrev" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'splitLR'"}}), () => "splitLR" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'splitMoveR'"}}), () => "splitMoveR" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'splitTB'"}}), () => "splitTB" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'tabToWindow'"}}), () => "tabToWindow" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'splitMoveB'"}}), () => "splitMoveB" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'stickSearch'"}}), () => "stickSearch" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'unsplit'"}}), () => "unsplit" as const)
    .split(type({navigation: {pressedNavigationHotkey: "'unsplitAll'"}}), () => "unsplitAll" as const)
    .otherwise(() => "delegated" as const)
    .build();

it("routes a long hierarchical state chain without changing branch semantics", () => {
    expect(longNavigationRouter({
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
