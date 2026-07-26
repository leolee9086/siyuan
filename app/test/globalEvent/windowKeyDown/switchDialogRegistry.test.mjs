import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {getSForgeState, setSForgeState} from "../../../src/config/sforge.global";
import {WINDOW_KEYDOWN_SWITCH_DIALOG} from "../../../src/config/sforge.symbols";

afterEach(() => {
    setSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG, undefined);
});

describe("window keydown switch dialog registry", () => {
    it("shares and replaces the current dialog through the unified state registry", () => {
        const firstDialog = {element: {id: "first"}};
        const secondDialog = {element: {id: "second"}};

        setSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG, firstDialog);
        assert.equal(getSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG), firstDialog);

        setSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG, secondDialog);
        assert.equal(getSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG), secondDialog);
    });
});
