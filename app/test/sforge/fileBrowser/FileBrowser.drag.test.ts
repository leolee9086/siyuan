import {describe, expect, it} from "vitest";
import {parseFileBrowserDragData} from "../../../src/sforge/fileBrowser/FileBrowser.drag";

describe("file browser drag data", () => {
    it("normalizes root-relative paths and derives a missing name", () => {
        expect(parseFileBrowserDragData(JSON.stringify({
            rootID: "workspace", path: "\\assets\\中文.png\\", kind: "file",
        }))).toEqual({rootID: "workspace", path: "assets/中文.png", kind: "file", name: "中文.png"});
    });

    it("keeps a selected set as individually authorized root-relative items", () => {
        expect(parseFileBrowserDragData(JSON.stringify({
            rootID: "workspace", path: "assets/one.txt", kind: "file", name: "one.txt",
            items: [
                {rootID: "workspace", path: "assets/one.txt", kind: "file", name: "one.txt"},
                {rootID: "agent", path: "drafts/two.txt", kind: "file", name: "two.txt"},
            ],
        }))).toEqual({
            rootID: "workspace", path: "assets/one.txt", kind: "file", name: "one.txt",
            items: [
                {rootID: "workspace", path: "assets/one.txt", kind: "file", name: "one.txt"},
                {rootID: "agent", path: "drafts/two.txt", kind: "file", name: "two.txt"},
            ],
        });
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
