import {describe, expect, it, vi} from "vitest";
import {createFileBrowserEntryOpener} from "../../../src/sforge/fileBrowser/FileBrowser.open";
import type {
    FileBrowserEntry,
    FileBrowserFileStat,
    FileBrowserRepository,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const entry: FileBrowserEntry = {
    name: "photo.png", path: "images/photo.png", isDir: false, isSymlink: false,
    restricted: false, hidden: false, size: 10, updated: 1, extension: ".png",
};

const root = {
    id: "workspace", kind: "workspace" as const, label: "workspace", path: "D:\\workspace",
    permission: "read-write" as const, capabilities: {browse: true, write: true, command: false}, exists: true,
};

function repository(stat: FileBrowserFileStat): FileBrowserRepository {
    return {
        listRoots: vi.fn(async () => [root]),
        listDirectory: vi.fn(),
        statFile: vi.fn(async () => stat),
        previewText: vi.fn(),
    };
}

describe("file browser opening", () => {
    it("reuses the existing Asset tab for supported media", async () => {
        const stat: FileBrowserFileStat = {
            root, entry, mediaType: "image/png", previewKind: "image",
            contentURL: "/api/s-forge/file-browser/content/workspace/images/photo.png", revision: "1-a",
        };
        const app = {openAsset: vi.fn(), openTab: vi.fn()};

        await createFileBrowserEntryOpener(app, repository(stat))("workspace", entry);

        expect(app.openAsset).toHaveBeenCalledWith({assetPath: stat.contentURL});
        expect(app.openTab).not.toHaveBeenCalled();
    });

    it("uses the registered preview tab for text with root-relative identity", async () => {
        const textEntry = {...entry, name: "guide.md", path: "docs/guide.md", extension: ".md"};
        const stat: FileBrowserFileStat = {
            root, entry: textEntry, mediaType: "text/markdown", previewKind: "text",
            contentURL: "/api/s-forge/file-browser/content/workspace/docs/guide.md", revision: "2-a",
        };
        const app = {openAsset: vi.fn(), openTab: vi.fn(async () => undefined)};

        await createFileBrowserEntryOpener(app, repository(stat))("workspace", textEntry);

        expect(app.openTab).toHaveBeenCalledWith({
            custom: {
                title: "guide.md", icon: "iconCode", id: "sforge-file-preview",
                data: {rootID: "workspace", path: "docs/guide.md", name: "guide.md"},
            },
        });
        expect(app.openAsset).not.toHaveBeenCalled();
    });
});
