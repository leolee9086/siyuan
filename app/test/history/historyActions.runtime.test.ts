import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {ProtyleDomain} from "../../src/protyle/protyle.types";

const runtime = vi.hoisted(() => ({
    confirmDialog: vi.fn(),
    createProtyle: vi.fn(),
    disabledProtyle: vi.fn(),
    fetchPost: vi.fn(),
    onGet: vi.fn(),
    saveExportFile: vi.fn(),
}));

vi.mock("../../src/dialog/confirmDialog", () => ({
    confirmDialog: (title: string, message: string, confirm?: () => void) => {
        runtime.confirmDialog(title, message);
        confirm?.();
    },
}));
vi.mock("../../src/dialog", () => ({
    Dialog: class {
        public readonly element: HTMLElement;

        constructor(options: {content: string}) {
            this.element = document.createElement("div");
            this.element.innerHTML = options.content;
        }

        public bindInput() {}
        public destroy() {}
    },
}));
vi.mock("../../src/constants", () => ({
    Constants: {
        CB_GET_HISTORY: "getHistory",
        CB_GET_HTML: "getHTML",
        SIYUAN_ASSETS_IMAGE: [],
        SIYUAN_ASSETS_AUDIO: [],
        SIYUAN_ASSETS_VIDEO: [],
        ZWSP: "",
    },
}));
vi.mock("../../src/util/network/fetch", () => ({fetchPost: runtime.fetchPost}));
vi.mock("../../src/util/platform/functions", () => ({isMobile: () => false}));
vi.mock("../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSiyuanConfig: () => ({readonly: false}),
}));
vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {
        rollback: "Rollback",
        rollbackConfirm: "${name} at ${time}",
        workspaceData: "Workspace",
    },
}));
vi.mock("../../src/protyle/util/compatibility", () => ({saveExportFile: runtime.saveExportFile}));
vi.mock("../../src/protyle/util/onGet", () => ({
    disabledProtyle: runtime.disabledProtyle,
    onGet: runtime.onGet,
}));
vi.mock("../../src/asset/renderAssets", () => ({renderAssetsPreview: vi.fn(() => "")}));
vi.mock("../../src/util/file/path/operations", () => ({
    pathPosix: () => ({extname: (value: string) => value.slice(value.lastIndexOf("."))}),
}));
vi.mock("../../src/history/history.render", () => ({
    renderDoc: vi.fn(),
    renderRmNotebook: vi.fn(),
    renderRepo: vi.fn(),
}));
vi.mock("../../src/history/diff", () => ({showDiff: vi.fn()}));
vi.mock("../../src/protyle/util/hasClosest", () => ({hasClosestByClassName: vi.fn()}));
vi.mock("../../src/protyle/render/searchMarkRender", () => ({
    isSupportCSSHL: () => false,
    searchMarkRender: vi.fn(),
}));
vi.mock("../../src/mobile/util/closePanel", () => ({closeModel: vi.fn()}));

import {handleDocClick} from "../../src/history/history.docEvent";
import {handleRepoClick} from "../../src/history/history.repoEvent";

const createDocContext = (type: "doc" | "assets" | "av" | "notebook") => {
    const root = document.createElement("div");
    root.innerHTML = `<div id="historyContainer">
        <div data-type="doc">
            <div class="protyle-title__input"></div>
            <div class="history__text" data-type="assetPanel"></div>
            <textarea class="history__text" data-type="mdPanel"></textarea>
            <div class="history__text" data-type="docPanel"></div>
            <ul class="b3-list">
                <li class="b3-list-item" data-type="${type}" data-created="1720000000" data-path="history/path">
                    <span class="b3-list-item__text">Document</span>
                    <span class="b3-list-item__action" data-type="rollback"></span>
                </li>
            </ul>
        </div>
    </div>`;
    const firstPanelElement = root.querySelector<HTMLElement>('[data-type="doc"]');
    const target = root.querySelector<HTMLElement>('[data-type="rollback"]');
    if (!firstPanelElement || !target) {
        throw new Error("Invalid document history fixture");
    }
    const historyEditor = {
        protyle: {options: {history: {created: ""}}},
    } as ProtyleDomain;
    return {
        target,
        type: "rollback",
        event: new MouseEvent("click"),
        element: root,
        firstPanelElement,
        historyEditor,
        dialog: undefined,
        clearHistoryEditor: vi.fn(),
    };
};

const createRepoFixture = (type: "repoitem" | "searchFileItem") => {
    const root = document.createElement("div");
    root.innerHTML = `<button data-type="compare"></button>
        <ul>
            <li class="b3-list-item" data-type="${type}" data-id="file-id" data-snapshot="snapshot-id" data-created="1720000000000">
                <span class="b3-list-item__text">Snapshot file</span>
                <span data-type="hCreated">2026-07-29 12:00:00</span>
                <span class="b3-list-item__action" data-type="rollback"></span>
                <span class="b3-list-item__action" data-type="saveAs"></span>
                <span class="b3-list-item__action" data-type="view"></span>
            </li>
        </ul>`;
    const item = root.querySelector<HTMLElement>(".b3-list-item");
    const repoElement = document.createElement("div");
    const repoSelectElement = document.createElement("select");
    if (!item) {
        throw new Error("Invalid repository history fixture");
    }
    return {root, item, repoElement, repoSelectElement};
};

const createApp = () => ({createProtyle: runtime.createProtyle}) as AppFacade;

beforeEach(() => {
    vi.clearAllMocks();
    runtime.createProtyle.mockReturnValue({protyle: {}});
});

describe("history action ownership", () => {
    it("rolls back a document without the removed notebook request field", () => {
        expect(handleDocClick(createDocContext("doc"))).toBe(true);

        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/history/rollbackDocHistory",
            {historyPath: "history/path"},
        );
    });

    it.each([
        ["repoitem", "/api/repo/checkoutRepo"],
        ["searchFileItem", "/api/repo/rollbackRepoSnapshotFile"],
    ] as const)("routes %s rollback to its repository endpoint", (itemType, endpoint) => {
        const fixture = createRepoFixture(itemType);
        const target = fixture.item.querySelector<HTMLElement>('[data-type="rollback"]');
        if (!target) {
            throw new Error("Missing rollback action");
        }

        expect(handleRepoClick(
            target,
            "rollback",
            new MouseEvent("click"),
            createApp(),
            fixture.root,
            fixture.repoElement,
            fixture.repoSelectElement,
        )).toBe(true);
        expect(runtime.fetchPost).toHaveBeenCalledWith(endpoint, {id: "file-id"});
    });

    it("exports a repository file through the platform save action", () => {
        runtime.fetchPost.mockImplementation((
            _url: string,
            _data: object,
            callback: (response: IWebSocketData) => void,
        ) => callback(Object.assign({} as IWebSocketData, {data: {path: "export.zip"}})));
        const fixture = createRepoFixture("searchFileItem");
        const target = fixture.item.querySelector<HTMLElement>('[data-type="saveAs"]');
        if (!target) {
            throw new Error("Missing export action");
        }

        handleRepoClick(target, "saveAs", new MouseEvent("click"), createApp(), fixture.root, fixture.repoElement, fixture.repoSelectElement);

        expect(runtime.fetchPost).toHaveBeenCalledWith("/api/repo/exportRepoFile", {id: "file-id"}, expect.any(Function));
        expect(runtime.saveExportFile).toHaveBeenCalledWith("export.zip");
    });

    it("opens document previews with the search result snapshot id", () => {
        runtime.fetchPost.mockImplementation((
            _url: string,
            _data: object,
            callback: (response: IWebSocketData) => void,
        ) => callback(Object.assign({} as IWebSocketData, {
            data: {content: "document.sy", displayInText: false, title: "Document"},
        })));
        const fixture = createRepoFixture("searchFileItem");
        const target = fixture.item.querySelector<HTMLElement>('[data-type="view"]');
        if (!target) {
            throw new Error("Missing preview action");
        }

        handleRepoClick(target, "view", new MouseEvent("click"), createApp(), fixture.root, fixture.repoElement, fixture.repoSelectElement);

        expect(runtime.createProtyle).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({history: {snapshot: "snapshot-id"}}),
        );
        expect(runtime.disabledProtyle).toHaveBeenCalledOnce();
        expect(runtime.onGet).toHaveBeenCalledOnce();
    });
});
