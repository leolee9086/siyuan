import {describe, expect, test} from "vitest";
import {type} from "arktype";
import {calibur} from "calibur-router";

describe("CaliburRouter ArkType instance boundary", () => {
    test("accepts schemas constructed by the caller's ArkType instance", () => {
        const universe = type({
            isTabWindow: "boolean",
            navigation: {
                pressedNavigationHotkey: "string | null",
                replaceHotkey: "boolean",
                globalSearchHotkey: "boolean",
                searchHotkey: "boolean",
                saveHotkey: "boolean",
            },
        });
        const dispatch = calibur
            .universe(universe)
            .split(type({isTabWindow: "false", navigation: {pressedNavigationHotkey: "'mainMenu'"}}), () => "main")
            .remain(() => "delegated")
            .build();

        expect(dispatch({
            isTabWindow: false,
            navigation: {
                pressedNavigationHotkey: "mainMenu",
                replaceHotkey: false,
                globalSearchHotkey: false,
                searchHotkey: false,
                saveHotkey: false,
            },
        })).toBe("main");
    });

    test("does not require the package's build-time ArkType version", () => {
        const universe = type({mode: "'edit' | 'readonly'"});
        const dispatch = calibur
            .universe(universe)
            .split(type({mode: "'edit'"}), () => "edit")
            .remain(() => "readonly")
            .build();

        expect(dispatch({mode: "readonly"})).toBe("readonly");
    });
});
