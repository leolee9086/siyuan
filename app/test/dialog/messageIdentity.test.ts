import {beforeEach, describe, expect, it} from "vitest";
import {showMessage} from "../../src/dialog/message";

beforeEach(() => {
    document.body.innerHTML = '<div id="message"><div></div></div>';
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {zIndex: 1},
    });
});

describe("message identity", () => {
    it("returns the rendered message ID in the same call stack", () => {
        const messageId = showMessage("Exporting", -1);

        expect(typeof messageId).toBe("string");
        expect(document.querySelector(`.b3-snackbar[data-id="${messageId}"]`)).not.toBeNull();
    });
});
