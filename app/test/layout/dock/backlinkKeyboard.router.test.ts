import {describe, expect, it} from "vitest";
import {
    resolveBacklinkEditorKeyCommand,
    resolveBacklinkPanelKeyCommand,
} from "../../../src/layout/dock/backlink/backlinkKeyboard.router";

describe("Backlink keyboard state router", () => {
    it.each([
        [{insideBottomBacklink: true, insideNestedProtyle: false}, "ignore-bottom-chrome"],
        [{insideBottomBacklink: true, insideNestedProtyle: true}, "continue"],
        [{insideBottomBacklink: false, insideNestedProtyle: false}, "continue"],
    ] as const)("routes editor ownership from %o", (state, expected) => {
        expect(resolveBacklinkEditorKeyCommand(state)).toBe(expected);
    });

    it.each([
        [{insideBottomBacklink: false, insideTextControl: true, insideContentEditable: false, insideNestedProtyle: false}, "ignore"],
        [{insideBottomBacklink: true, insideTextControl: true, insideContentEditable: false, insideNestedProtyle: false}, "ignore"],
        [{insideBottomBacklink: false, insideTextControl: false, insideContentEditable: true, insideNestedProtyle: false}, "ignore"],
        [{insideBottomBacklink: true, insideTextControl: false, insideContentEditable: true, insideNestedProtyle: false}, "ignore"],
        [{insideBottomBacklink: false, insideTextControl: false, insideContentEditable: false, insideNestedProtyle: true}, "ignore"],
        [{insideBottomBacklink: true, insideTextControl: false, insideContentEditable: false, insideNestedProtyle: true}, "ignore"],
        [{insideBottomBacklink: true, insideTextControl: false, insideContentEditable: false, insideNestedProtyle: false}, "bottom-backlink"],
        [{insideBottomBacklink: false, insideTextControl: false, insideContentEditable: false, insideNestedProtyle: false}, "active-layout"],
    ] as const)("routes panel ownership from %o", (state, expected) => {
        expect(resolveBacklinkPanelKeyCommand(state)).toBe(expected);
    });
});
