import {describe, expect, it} from "vitest";
import FileBrowserPanel from "../../../src/sforge/fileBrowser/FileBrowserPanel.vue";
import FileBrowserPreviewPanel from "../../../src/sforge/fileBrowser/FileBrowserPreviewPanel.vue";
import FilePropertiesPanel from "../../../src/sforge/fileBrowser/FilePropertiesPanel.vue";

describe("file browser panel compilation", () => {
    it("compiles the real Vue template and external SCSS entry", () => {
        expect(FileBrowserPanel).toBeTruthy();
        expect(FileBrowserPreviewPanel).toBeTruthy();
        expect(FilePropertiesPanel).toBeTruthy();
    });
});
