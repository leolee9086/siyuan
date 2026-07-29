import {beforeEach, describe, expect, it, vi} from "vitest";
import type {MenuItem} from "../../src/menus/Menu";
import type {rename} from "../../src/editor/rename";
import type {fetchPost} from "../../src/util/network/fetch";
import type {movePathTo, moveToPath} from "../../src/util/pathName";

const state = vi.hoisted(() => ({
    encrypted: false,
    moveMenu: undefined as ConstructorParameters<typeof MenuItem>[0] | undefined,
    movePathTo: vi.fn<typeof movePathTo>(),
    moveToPath: vi.fn<typeof moveToPath>(),
    rename: vi.fn<typeof rename>(),
    renameMenu: undefined as ConstructorParameters<typeof MenuItem>[0] | undefined,
    fetchPost: vi.fn<typeof fetchPost>(),
}));

vi.mock("../../src/menus/commonMenuItem/rename/imports", () => ({
    Constants: {CUSTOM_SY_TITLE_EMPTY: "custom-sy-title-empty"},
    fetchPost: state.fetchPost,
    getSiyuanConfig: () => window.siyuan.config,
    getSiyuanLanguages: () => window.siyuan.languages,
    isEncryptedBox: () => state.encrypted,
    MenuItem: class {
        public element = document.createElement("button");

        constructor(options: ConstructorParameters<typeof MenuItem>[0]) {
            state.renameMenu = options;
        }
    },
    rename: state.rename,
}));

vi.mock("../../src/menus/commonMenuItem/movePath/imports", () => ({
    getSiyuanConfig: () => window.siyuan.config,
    getSiyuanLanguages: () => window.siyuan.languages,
    MenuItem: class {
        public element = document.createElement("button");

        constructor(options: ConstructorParameters<typeof MenuItem>[0]) {
            state.moveMenu = options;
        }
    },
    movePathTo: state.movePathTo,
    moveToPath: state.moveToPath,
    pathPosix: () => ({
        basename: (value: string) => value.split("/").at(-1) ?? "",
    }),
}));

import {movePathToMenu} from "../../src/menus/commonMenuItem/movePath/movePathToMenu.factory";
import {renameMenu} from "../../src/menus/commonMenuItem/rename/renameMenu.factory";

const runClick = (menu: ConstructorParameters<typeof MenuItem>[0] | undefined) => {
    if (!menu?.click) {
        throw new Error("Expected menu click action");
    }
    menu.click(document.createElement("button"), new MouseEvent("click"));
};

beforeEach(() => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {
                keymap: {
                    editor: {general: {rename: {custom: "F2"}}},
                    general: {move: {custom: "Ctrl+M"}},
                },
            },
            languages: {move: "Move", rename: "Rename"},
        },
    });
    state.encrypted = false;
    state.moveMenu = undefined;
    state.renameMenu = undefined;
    vi.clearAllMocks();
});

describe("common menu rename action", () => {
    it("renames notebooks directly without requesting document information", () => {
        const options = {
            path: "/notebook",
            notebookId: "box",
            name: "Notebook",
            type: "notebook" as const,
        };

        renameMenu(options);
        expect(state.renameMenu).toMatchObject({
            id: "rename",
            accelerator: "F2",
            icon: "iconEdit",
            label: "Rename",
        });
        runClick(state.renameMenu);

        expect(state.fetchPost).not.toHaveBeenCalled();
        expect(state.rename).toHaveBeenCalledWith(options);
    });

    it("preserves encrypted notebook context until document information resolves", () => {
        state.encrypted = true;
        renameMenu({
            path: "/doc.sy",
            notebookId: "encrypted-box",
            name: "Stored name",
            type: "file",
            docId: "doc-id",
        });

        runClick(state.renameMenu);
        expect(state.rename).not.toHaveBeenCalled();
        expect(state.fetchPost).toHaveBeenCalledWith(
            "/api/block/getDocInfo",
            {id: "doc-id", notebook: "encrypted-box"},
            expect.any(Function),
        );

        const callback = state.fetchPost.mock.calls[0]?.[2];
        if (!callback) {
            throw new Error("Expected document information callback");
        }
        callback({
            code: 0,
            msg: "",
            data: {
                ial: {
                    title: "Resolved title",
                    "custom-sy-title-empty": "true",
                },
            },
        });

        expect(state.rename).toHaveBeenCalledWith({
            path: "/doc.sy",
            notebookId: "encrypted-box",
            name: "Resolved title",
            type: "file",
            docId: "doc-id",
            empty: true,
        });
    });
});

describe("common menu move action", () => {
    it("preserves path order, derived root IDs, and selected destination arguments", () => {
        const paths = ["/first.sy", "/nested/second.sy"];
        movePathToMenu(paths);
        expect(state.moveMenu).toMatchObject({
            id: "move",
            accelerator: "Ctrl+M",
            icon: "iconMove",
            label: "Move",
        });

        runClick(state.moveMenu);
        const options = state.movePathTo.mock.calls[0]?.[0];
        if (!options) {
            throw new Error("Expected move path dialog options");
        }
        expect(options).toMatchObject({
            paths,
            flashcard: false,
            rootIDs: ["first", "second"],
        });

        options.cb(["/destination"], ["target-box"]);
        expect(state.moveToPath).toHaveBeenCalledWith(paths, "target-box", "/destination");
    });

    it("reports an invalid empty destination instead of silently skipping the move", () => {
        movePathToMenu(["/first.sy"]);
        runClick(state.moveMenu);
        const options = state.movePathTo.mock.calls[0]?.[0];
        if (!options) {
            throw new Error("Expected move path dialog options");
        }

        expect(() => options.cb([], [])).toThrow("移动目标缺少路径或笔记本标识");
        expect(state.moveToPath).not.toHaveBeenCalled();
    });
});
