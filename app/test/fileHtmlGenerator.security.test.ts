import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../src/emoji/emoji.render", () => ({
    unicode2Emoji: (value: string) => value,
}));

import {generateFileItemHTML} from "../src/util/file/fileHtmlGenerator";
import {Constants} from "../src/constants";

const malicious = `<img src=x onerror="alert(1)">`;

beforeEach(() => {
    Object.assign(window, {
        siyuan: {
            config: {lang: "en"},
            languages: {
                _kernel: {16: "Untitled"},
                alias: "Alias",
                bookmark: "Bookmark",
                createdAt: "Created",
                flashcardCard: "Card",
                flashcardDueCard: "Due",
                flashcardNewCard: "New",
                includeSubFile: "x children",
                memo: "Memo",
                modifiedAt: "Modified",
                name: "Name",
                ref: "References",
            },
            storage: {
                [Constants.LOCAL_IMAGES]: {file: "file", folder: "folder"},
            },
        },
    });
    Object.assign(globalThis, {
        Lute: {
            EscapeHTMLStr: (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
        },
    });
});

describe("file picker metadata security", () => {
    it("escapes metadata embedded in the child-document tooltip", () => {
        const html = generateFileItemHTML({
            alias: malicious,
            bookmark: malicious,
            count: 0,
            hCtime: "2026-08-29",
            hMtime: "2026-08-29",
            hSize: "1 KB",
            icon: "",
            memo: malicious,
            name: "document.sy",
            name1: malicious,
            path: "/document.sy",
            subFileCount: 0,
            titleEmpty: false,
        } as IFile, "notebook");

        expect(html).not.toContain(malicious);
        expect(html.match(/&amp;lt;img/g)).toHaveLength(4);
    });
});
