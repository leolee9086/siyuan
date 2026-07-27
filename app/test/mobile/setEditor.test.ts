import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    setTitle: vi.fn(),
}));

vi.mock("../../src/util/processTitle", () => ({
    setTitle: runtime.setTitle,
}));

import {setEditor} from "../../src/mobile/util/workspace/setEditor";

describe("mobile editor workspace", () => {
    beforeEach(() => {
        runtime.setTitle.mockReset();
        document.body.innerHTML = `
            <input id="toolbarName" class="fn__hidden" value="Document title">
            <div id="editor" class="fn__none"></div>
            <div id="empty"></div>`;
    });

    it("switches the initialized workspace from empty state to the editor", () => {
        setEditor();

        expect(runtime.setTitle).toHaveBeenCalledWith("Document title");
        expect(document.getElementById("toolbarName")?.classList.contains("fn__hidden")).toBe(false);
        expect(document.getElementById("editor")?.classList.contains("fn__none")).toBe(false);
        expect(document.getElementById("empty")?.classList.contains("fn__none")).toBe(true);
    });

    it("fails explicitly when the mobile workspace is not initialized", () => {
        document.getElementById("editor")?.remove();

        expect(() => setEditor()).toThrow("Mobile editor workspace is not initialized");
    });
});
