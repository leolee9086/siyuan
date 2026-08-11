import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import FileBrowserNetworkPanel from "../../../src/sforge/fileBrowser/FileBrowserNetworkPanel.vue";

const fixture = vi.hoisted(() => {
    let value = "";
    const model = {
        dispose: vi.fn(),
    };
    const editor = {
        dispose: vi.fn(),
    };
    const monaco = {
        editor: {
            createModel: vi.fn((text: string) => {
                value = text;
                return model;
            }),
            create: vi.fn(() => editor),
        },
        Uri: {parse: vi.fn((uri: string) => ({toString: () => uri}))},
    };
    const read = vi.fn();
    return {
        monaco,
        read,
        model,
        editor,
        getValue: () => value,
        reset() {
            value = "";
            read.mockReset();
            model.dispose.mockClear();
            editor.dispose.mockClear();
            monaco.editor.createModel.mockClear();
            monaco.editor.create.mockClear();
            monaco.Uri.parse.mockClear();
        },
    };
});

vi.mock("../../../src/sforge/fileBrowser/FileBrowserEditor.monaco", () => ({
    loadFileBrowserMonaco: vi.fn(async () => fixture.monaco),
}));
vi.mock("../../../src/sforge/fileBrowser/FileBrowser.network", () => ({
    readFileBrowserNetworkFile: fixture.read,
}));

const file = {uri: "https://example.test/docs/guide.md", name: "guide.md"};
const networkDocument = {
    ...file,
    text: "# guide\n",
    language: "markdown",
    contentType: "text/markdown",
    size: 8,
    readOnly: true as const,
};

async function flush() {
    for (let index = 0; index < 6; index++) {
        await Promise.resolve();
        await nextTick();
    }
}

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

describe("FileBrowserNetworkPanel", () => {
    beforeEach(() => {
        fixture.reset();
        fixture.read.mockResolvedValue(networkDocument);
    });

    afterEach(() => {
        app?.unmount();
        host?.remove();
        app = undefined;
        host = undefined;
        vi.restoreAllMocks();
    });

    it("mounts a read-only Monaco model without a save action", async () => {
        host = globalThis.document.createElement("div");
        globalThis.document.body.append(host);
        app = createApp(FileBrowserNetworkPanel, {file});
        app.mount(host);
        await flush();

        expect(fixture.read).toHaveBeenCalledWith(expect.objectContaining({uri: file.uri, signal: expect.any(AbortSignal)}));
        expect(fixture.monaco.editor.createModel).toHaveBeenCalledWith(
            networkDocument.text, networkDocument.language, expect.anything(),
        );
        expect(fixture.monaco.editor.create).toHaveBeenCalledWith(
            host.querySelector(".sforge-file-network__monaco"),
            expect.objectContaining({readOnly: true, automaticLayout: true}),
        );
        expect(host.querySelector("[aria-label='保存文件']")).toBeNull();
        expect(host.textContent).toContain("只读网络文件");
    });

    it("keeps a request failure visible and retries explicitly", async () => {
        fixture.read.mockRejectedValueOnce(new Error("HTTP 503 Service Unavailable"))
            .mockResolvedValueOnce(networkDocument);
        host = globalThis.document.createElement("div");
        globalThis.document.body.append(host);
        app = createApp(FileBrowserNetworkPanel, {file});
        app.mount(host);
        await flush();

        expect(host.textContent).toContain("HTTP 503 Service Unavailable");
        const retry = host.querySelector<HTMLButtonElement>(".sforge-file-network__state button");
        expect(retry).not.toBeNull();
        retry?.click();
        await flush();
        expect(fixture.read).toHaveBeenCalledTimes(2);
        expect(host.textContent).toContain("只读网络文件");
    });
});
