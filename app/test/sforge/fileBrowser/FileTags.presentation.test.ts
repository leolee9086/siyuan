import {describe, expect, it} from "vitest";
import {
    createPerFileTagPresentations,
    createTagPresentations,
    fallbackTagColor,
} from "../../../src/sforge/fileBrowser/FileTags.presentation";
import type {FilePropertiesItem} from "../../../src/sforge/fileBrowser/FileProperties.types";

function item(path: string, tags: string[]): FilePropertiesItem {
    const request = {rootID: "workspace", path};
    return {
        request,
        properties: {
            root: {
                id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
                permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
            },
            entry: {
                name: path, path, isDir: false, isSymlink: false, restricted: false,
                hidden: false, size: 1, updated: 1, extension: ".md",
            },
            previewKind: "text",
            revision: `revision-${path}`,
            readOnly: false,
        },
        metadata: {
            rootID: "workspace", path, name: path, tags, star: 0, annotation: "",
            boundBlockId: "", source: "", sourceId: "", importTime: 0,
        },
        metadataPersisted: true,
        metadataWritable: true,
    };
}

describe("file tag presentation", () => {
    it("uses a normalized deterministic fallback and readable foreground", () => {
        expect(fallbackTagColor(" Review ")).toBe(fallbackTagColor("review"));
        expect(fallbackTagColor("Review")).toMatch(/^#[0-9A-F]{6}$/);
        const tags = createTagPresentations([item("one.md", ["Review"])], []);
        expect(tags[0]).toMatchObject({name: "Review", count: 1, configured: false});
        expect(["#000000", "#FFFFFF"]).toContain(tags[0]?.foreground);
    });

    it("aggregates once per file and keeps root-aware per-file rows", () => {
        const items = [
            item("one.md", ["Review", " review ", "Blue"]),
            item("two.md", ["review"]),
        ];
        const definitions = [{name: "review", color: "#112233"}];
        const aggregate = createTagPresentations(items, definitions);
        expect(aggregate).toEqual([
            expect.objectContaining({name: "Blue", count: 1, configured: false}),
            expect.objectContaining({name: "Review", count: 2, color: "#112233", foreground: "#FFFFFF", configured: true}),
        ]);
        const perFile = createPerFileTagPresentations(items, definitions);
        expect(perFile).toHaveLength(2);
        expect(perFile[0]?.request).toEqual({rootID: "workspace", path: "one.md"});
        expect(perFile[0]?.tags.map(tag => tag.name)).toEqual(["Blue", "Review"]);
    });
});
