import {describe, expect, it} from "vitest";
import {
    buildFileBrowserBreadcrumbs,
    parentFileBrowserPath,
    splitFileBrowserPath,
} from "../../../src/sforge/fileBrowser/FileBrowser.navigation";
import {
    formatFileBrowserPermission,
    formatFileBrowserSize,
} from "../../../src/sforge/fileBrowser/FileBrowser.presentation";

describe("file browser navigation and presentation", () => {
    it("normalizes separators while preserving root-relative breadcrumb paths", () => {
        expect(splitFileBrowserPath("docs\\api/reference")).toEqual(["docs", "api", "reference"]);
        expect(buildFileBrowserBreadcrumbs("workspace", "docs/api")).toEqual([
            {label: "workspace", path: ""},
            {label: "docs", path: "docs"},
            {label: "api", path: "docs/api"},
        ]);
        expect(parentFileBrowserPath("docs/api")).toBe("docs");
        expect(parentFileBrowserPath("")).toBe("");
    });

    it("formats compact permission and file-size labels", () => {
        expect(formatFileBrowserPermission("read-write")).toBe("可读写");
        expect(formatFileBrowserPermission("read-only")).toBe("只读");
        expect(formatFileBrowserSize(0)).toBe("0 B");
        expect(formatFileBrowserSize(1536)).toBe("1.5 KB");
        expect(formatFileBrowserSize(0, true)).toBe("文件夹");
    });
});
