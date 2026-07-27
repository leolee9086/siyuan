import {beforeEach, describe, expect, it, vi} from "vitest";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

type TestResponse = {data: {keywords?: string[]}};
type ResponseCallback = (response: TestResponse) => void;

const runtime = vi.hoisted(() => ({
    currentArticleId: "",
    callbacks: new Map<string, ResponseCallback[]>(),
    addLoading: vi.fn(),
    onGet: vi.fn((options: {afterCB?: () => void}) => options.afterCB?.()),
    titleRender: vi.fn(),
}));

vi.mock("../../src/search/article/imports", () => ({
    ARTICLE_PREVIEW_CURRENT_ID: Symbol.for("test.search.articlePreviewCurrentId"),
    Constants: {CB_GET_ALL: "all", CB_GET_HTML: "html", SIZE_GET_MAX: 1024, TIMEOUT_COUNT: 100},
    addLoading: runtime.addLoading,
    checkFold: (_id: string, callback: (zoomIn: boolean) => void) => callback(false),
    createResizeObserver: vi.fn(),
    fetchPost: (url: string, _params: object, callback: ResponseCallback) => {
        const callbacks = runtime.callbacks.get(url) ?? [];
        callbacks.push(callback);
        runtime.callbacks.set(url, callbacks);
    },
    getSForgeState: () => runtime.currentArticleId,
    getSiyuanConfig: () => ({editor: {dynamicLoadBlocks: 64}}),
    highlightById: vi.fn(),
    isEncryptedBox: () => false,
    isSupportCSSHL: () => false,
    onGet: runtime.onGet,
    scrollToCurrent: vi.fn(),
    searchMarkRender: vi.fn(),
    setSForgeState: (_key: symbol, value: string) => {
        runtime.currentArticleId = value;
    },
}));

import {getArticle} from "../../src/search/article/getArticle";
import {getAttr} from "../../src/search/result/getAttr";

/** Build the Protyle state read by the article preview without replacing the shared domain fixture. */
const createArticleEditor = () => {
    const edit = createProtyleDomainFixture();
    const contentElement = document.createElement("div");
    const wysiwygElement = document.createElement("div");
    Object.assign(edit.protyle, {
        contentElement,
        element: document.createElement("div"),
        highlight: {rangeIndex: 0, ranges: []},
        notebookId: "notebook",
        options: {render: {title: true}},
        scroll: {lastScrollTop: 20},
        title: {render: runtime.titleRender},
        wysiwyg: {element: wysiwygElement},
    });
    return edit;
};

/** Invoke the next captured response callback for one endpoint. */
const respond = (url: string, response: TestResponse) => {
    const callback = runtime.callbacks.get(url)?.shift();
    if (!callback) {
        throw new Error(`No pending callback for ${url}`);
    }
    callback(response);
};

describe("search article preview", () => {
    beforeEach(() => {
        runtime.currentArticleId = "";
        runtime.callbacks.clear();
        runtime.addLoading.mockClear();
        runtime.onGet.mockClear();
        runtime.titleRender.mockClear();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {config: {editor: {dynamicLoadBlocks: 64}}},
        });
    });

    it("starts synchronously and applies document info before the article response", () => {
        const edit = createArticleEditor();

        const result = getArticle({id: "article-a", edit, value: "query"});

        expect(result).toBeUndefined();
        expect(runtime.currentArticleId).toBe("article-a");
        expect(edit.protyle.scroll?.lastScrollTop).toBe(0);
        expect(runtime.addLoading).toHaveBeenCalledWith(edit.protyle);
        expect(runtime.callbacks.get("/api/block/getDocInfo")).toHaveLength(1);

        const docInfoResponse = {data: {}};
        respond("/api/block/getDocInfo", docInfoResponse);
        expect(runtime.callbacks.get("/api/filetree/getDoc")).toHaveLength(1);

        const documentResponse = {data: {keywords: []}};
        respond("/api/filetree/getDoc", documentResponse);
        expect(runtime.onGet).toHaveBeenCalledOnce();
        expect(edit.protyle.query).toEqual({key: "query", method: null, types: null, subTypes: null});
        expect(runtime.titleRender).toHaveBeenCalledWith(edit.protyle, docInfoResponse);
    });

    it("discards document-info callbacks after another article becomes current", () => {
        const edit = createArticleEditor();
        getArticle({id: "article-a", edit});
        getArticle({id: "article-b", edit});

        respond("/api/block/getDocInfo", {data: {}});

        expect(runtime.callbacks.get("/api/filetree/getDoc")).toBeUndefined();
        expect(runtime.currentArticleId).toBe("article-b");
    });

    it("renders all available block metadata in its established order", () => {
        const html = getAttr({name: "Name", alias: "Alias", memo: "Memo", ial: {}});

        expect(html).toContain("#iconN");
        expect(html).toContain("#iconA");
        expect(html).toContain("#iconM");
        expect(html.indexOf("Name")).toBeLessThan(html.indexOf("Alias"));
        expect(html.indexOf("Alias")).toBeLessThan(html.indexOf("Memo"));
    });
});
