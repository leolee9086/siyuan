import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserEditorPanel from "../../../src/sforge/fileBrowser/FileBrowserEditorPanel.vue";
import {fileBrowserRepository} from "../../../src/sforge/fileBrowser/FileBrowser.repository";
import {FILE_BROWSER_EDITOR_PREFERENCES_KEY} from "../../../src/sforge/fileBrowser/FileBrowserEditor.preferences";

const monacoFixture = vi.hoisted(() => {
    let text = "";
    let changeListener: (() => void) | undefined;
    const actions = new Map<string, () => unknown>();
    const model = {
        getValue: () => text,
        onDidChangeContent: (listener: () => void) => {
            changeListener = listener;
            return {dispose: () => { if (changeListener === listener) changeListener = undefined; }};
        },
        dispose: vi.fn(),
    };
    const editor = {
        updateOptions: vi.fn(),
        addAction: vi.fn((action: {id: string; run: () => unknown}) => {
            actions.set(action.id, action.run);
            return {dispose: () => actions.delete(action.id)};
        }),
        dispose: vi.fn(),
    };
    const monaco = {
        editor: {
            createModel: vi.fn((value: string) => { text = value; return model; }),
            create: vi.fn(() => editor),
        },
        Uri: {parse: vi.fn((value: string) => ({toString: () => value}))},
        KeyMod: {CtrlCmd: 1, Alt: 2},
        KeyCode: {KeyS: 1, KeyZ: 2},
    };
    return {
        monaco,
        editor,
        reset(value = "") {
            text = value;
            changeListener = undefined;
            actions.clear();
            editor.updateOptions.mockClear();
            editor.addAction.mockClear();
            editor.dispose.mockClear();
            model.dispose.mockClear();
            monaco.editor.createModel.mockClear();
            monaco.editor.create.mockClear();
            monaco.Uri.parse.mockClear();
        },
        setText(value: string) {
            text = value;
            changeListener?.();
        },
        runAction(id: string) {
            return actions.get(id)?.();
        },
    };
});

vi.mock("../../../src/sforge/fileBrowser/FileBrowserEditor.monaco", () => ({
    loadFileBrowserMonaco: vi.fn(async () => monacoFixture.monaco),
}));

const root = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
} as const;

const editorDocument = {
    root,
    entry: {
        name: "guide.md", path: "notes/guide.md", isDir: false, isSymlink: false,
        restricted: false, hidden: false, size: 8, updated: 100, extension: ".md",
    },
    previewKind: "text" as const,
    contentURL: "/api/s-forge/file-browser/content/workspace/notes/guide.md",
    text: "# guide\n", encoding: "utf-8" as const, size: 8, updated: 100,
    revision: "rev-1", readOnly: false, language: "markdown",
};

function writeResult(revision: string) {
    return {...editorDocument, text: undefined, revision, size: 9, updated: 101};
}

async function flush() {
    for (let index = 0; index < 8; index++) {
        await Promise.resolve();
        await nextTick();
    }
}

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

describe("FileBrowserEditorPanel interactions", () => {
    beforeEach(() => {
        monacoFixture.reset(editorDocument.text);
        localStorage.removeItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY);
    });

    afterEach(() => {
        app?.unmount();
        host?.remove();
        vi.restoreAllMocks();
        vi.useRealTimers();
        localStorage.removeItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY);
        app = undefined;
        host = undefined;
    });

    it("applies persisted editor preferences and exposes Monaco actions", async () => {
        localStorage.setItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY, JSON.stringify({
            wordWrap: "off", tabSize: 2, autoSave: false, autoSaveDelay: 500,
            minimap: true, fontSize: 18,
        }));
        vi.spyOn(fileBrowserRepository, "readEditorFile").mockResolvedValue(editorDocument);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserEditorPanel, {file: {rootID: root.id, path: editorDocument.entry.path, name: editorDocument.entry.name}});
        app.mount(host);
        await flush();

        expect(host.querySelector<HTMLSelectElement>("[aria-label='字体大小']")?.value).toBe("18");
        expect(host.querySelector<HTMLInputElement>("[aria-label='缩略图']")?.checked).toBe(true);
        expect(monacoFixture.editor.updateOptions).toHaveBeenCalledWith(expect.objectContaining({
            wordWrap: "off", tabSize: 2, fontSize: 18, minimap: {enabled: true},
        }));
        expect(monacoFixture.editor.addAction).toHaveBeenCalledTimes(2);
        expect(monacoFixture.runAction("sforge.file-browser.toggle-word-wrap")).toBeUndefined();
        await nextTick();
        expect(host.querySelector<HTMLSelectElement>("[aria-label='自动换行']")?.value).toBe("on");
    });

    it("reschedules auto-save when editing continues during a successful save", async () => {
        vi.useFakeTimers();
        localStorage.setItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY, JSON.stringify({
            autoSave: true, autoSaveDelay: 200,
        }));
        vi.spyOn(fileBrowserRepository, "readEditorFile").mockResolvedValue(editorDocument);
        const write = vi.spyOn(fileBrowserRepository, "writeEditorFile")
            .mockResolvedValue(writeResult("rev-next"))
            .mockResolvedValueOnce(writeResult("rev-2"));
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserEditorPanel, {file: {rootID: root.id, path: editorDocument.entry.path, name: editorDocument.entry.name}});
        app.mount(host);
        await flush();

        monacoFixture.setText("# first\n");
        vi.advanceTimersByTime(200);
        await flush();
        expect(write).toHaveBeenCalledTimes(1);

        let resolveSecond!: (value: typeof editorDocument) => void;
        write.mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
        monacoFixture.setText("# second\n");
        vi.advanceTimersByTime(200);
        await flush();
        expect(write).toHaveBeenCalledTimes(2);

        monacoFixture.setText("# typed while saving\n");
        resolveSecond(writeResult("rev-3") as typeof editorDocument);
        await flush();
        vi.advanceTimersByTime(199);
        await flush();
        expect(write).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(1);
        await flush();
        expect(write).toHaveBeenCalledTimes(3);
        expect(write.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
            text: "# typed while saving\n", revision: "rev-3",
        }));
    });

    it("does not retry a failed auto-save in a loop", async () => {
        vi.useFakeTimers();
        localStorage.setItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY, JSON.stringify({
            autoSave: true, autoSaveDelay: 200,
        }));
        vi.spyOn(fileBrowserRepository, "readEditorFile").mockResolvedValue(editorDocument);
        const write = vi.spyOn(fileBrowserRepository, "writeEditorFile")
            .mockRejectedValue(new Error("disk full"));
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserEditorPanel, {file: {rootID: root.id, path: editorDocument.entry.path, name: editorDocument.entry.name}});
        app.mount(host);
        await flush();

        monacoFixture.setText("# failed\n");
        vi.advanceTimersByTime(200);
        await flush();
        vi.advanceTimersByTime(2000);
        await flush();
        expect(write).toHaveBeenCalledOnce();
        expect(host.textContent).toContain("disk full");
    });

    it("invalidates a pending document load when the editor tab is closed", async () => {
        let resolveRead!: (value: typeof editorDocument) => void;
        vi.spyOn(fileBrowserRepository, "readEditorFile")
            .mockImplementation(() => new Promise(resolve => { resolveRead = resolve; }));
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileBrowserEditorPanel, {file: {rootID: root.id, path: editorDocument.entry.path, name: editorDocument.entry.name}});
        app.mount(host);
        await Promise.resolve();
        app.unmount();
        app = undefined;
        resolveRead(editorDocument);
        await flush();

        expect(monacoFixture.monaco.editor.createModel).not.toHaveBeenCalled();
        expect(monacoFixture.monaco.editor.create).not.toHaveBeenCalled();
    });
});
