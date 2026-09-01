import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
    const dialogs: Array<{element: HTMLElement; options: {title: string}; bindInput: () => void; destroy: () => void}> = [];

    class Dialog {
        element = document.createElement("div");
        options: {title: string; content: string};

        constructor(options: {title: string; content: string}) {
            this.options = options;
            this.element.innerHTML = options.content;
            dialogs.push(this);
        }

        bindInput() {
            // The factory only needs this method to bind its already-tested submit callback.
        }

        destroy() {
            // No lifecycle behavior is needed for the duplicate-dialog regression.
        }
    }

    return {dialogs, Dialog};
});

vi.mock("../src/util/file/notebookAccess/openEncryptedNotebook/imports", () => ({
    Dialog: mocks.Dialog,
    escapeHtml: (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    fetchSyncPost: vi.fn(),
    getSiyuanLanguages: () => ({
        cancel: "Cancel",
        confirm: "Confirm",
        encryptedNotebookRiskTip: "Risk",
        masterPassword: "Password",
        unlockEncryptedNotebook: "Unlock ${x}",
    }),
    isMobile: () => false,
}));

import {openEncryptedNotebook} from "../src/util/file/notebookAccess/openEncryptedNotebook/openEncryptedNotebook.factory";

beforeEach(() => {
    mocks.dialogs.length = 0;
    Object.assign(window, {siyuan: {dialogs: mocks.dialogs}});
});

describe("split encrypted notebook dialog security", () => {
    it("escapes the notebook title and suppresses a duplicate dialog for the same notebook", () => {
        openEncryptedNotebook("notebook-id", `<img src=x onerror="alert(1)">`);

        expect(mocks.dialogs).toHaveLength(1);
        expect(mocks.dialogs[0].options.title).toBe("Unlock &lt;img src=x onerror=\"alert(1)\">");
        expect(mocks.dialogs[0].element.getAttribute("data-key")).toBe("encryptedNotebook-notebook-id");

        openEncryptedNotebook("notebook-id", "same notebook");

        expect(mocks.dialogs).toHaveLength(1);
    });
});
