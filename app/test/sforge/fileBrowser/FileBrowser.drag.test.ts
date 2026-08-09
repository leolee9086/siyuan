import {describe, expect, it} from "vitest";
import {parseFileBrowserDragData} from "../../../src/sforge/fileBrowser/FileBrowser.drag";

describe("file browser drag data", () => {
    it("normalizes root-relative paths and derives a missing name", () => {
        expect(parseFileBrowserDragData(JSON.stringify({
            rootID: "workspace", path: "\\assets\\中文.png\\", kind: "file",
        }))).toEqual({rootID: "workspace", path: "assets/中文.png", kind: "file", name: "中文.png"});
    });

    it.each([
        "",
        "not-json",
        JSON.stringify({rootID: "workspace", path: "../outside.txt", kind: "file", name: "outside.txt"}),
        JSON.stringify({rootID: "workspace", path: "assets/a.txt", kind: "root", name: "a.txt"}),
        JSON.stringify({rootID: "workspace", path: "assets/a.txt", kind: "file", name: "nested/a.txt"}),
    ])("rejects unsafe or unsupported payload %s", raw => {
        expect(parseFileBrowserDragData(raw)).toBeUndefined();
    });
});
