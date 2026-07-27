import {beforeEach, describe, expect, it, vi} from "vitest";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

const runtime = vi.hoisted(() => ({
    callback: undefined as ((response: {code: number; msg?: string}) => void) | undefined,
    calls: [] as string[],
    fetchPost: vi.fn((_url: string, _data: object, callback: (response: {code: number; msg?: string}) => void) => {
        runtime.calls.push("fetchPost");
        runtime.callback = callback;
    }),
    inputEvent: vi.fn(() => runtime.calls.push("inputEvent")),
    reloadProtyle: vi.fn(),
    saveKeyList: vi.fn(() => runtime.calls.push("saveKeyList")),
    showMessage: vi.fn(),
}));

vi.mock("../../src/search/replace/imports", () => ({
    fetchPost: runtime.fetchPost,
    getAllModels: () => ({editor: []}),
    getKeyByLiElement: () => "resolved-key",
    inputEvent: runtime.inputEvent,
    reloadProtyle: runtime.reloadProtyle,
    saveKeyList: runtime.saveKeyList,
    showMessage: runtime.showMessage,
    siyuanI18n: {_kernel: {132: "Replace unavailable"}},
}));

import {replace} from "../../src/search/replace/replace";

/** Build the controls and focused result consumed by the replace operation. */
const createReplaceElement = () => {
    const element = document.createElement("section");
    element.innerHTML = `
        <input id="searchInput" value="search value">
        <input id="replaceInput" value="replacement value">
        <svg class="fn__rotate fn__none"></svg>
        <div id="searchList">
            <div class="b3-list-item b3-list-item--focus" data-node-id="current" data-root-id="root"></div>
            <div class="b3-list-item" data-node-id="next" data-root-id="root"></div>
        </div>`;
    return element;
};

describe("search replace", () => {
    beforeEach(() => {
        runtime.callback = undefined;
        runtime.calls.length = 0;
        runtime.fetchPost.mockClear();
        runtime.inputEvent.mockClear();
        runtime.reloadProtyle.mockClear();
        runtime.saveKeyList.mockClear();
        runtime.showMessage.mockClear();
    });

    it("reports methods that do not support replacement without starting a request", () => {
        replace({element: createReplaceElement(), config: {method: 4}, edit: createProtyleDomainFixture(), isAll: false});

        expect(runtime.showMessage).toHaveBeenCalledWith("Replace unavailable");
        expect(runtime.fetchPost).not.toHaveBeenCalled();
    });

    it("preserves request and refresh order for one focused result", () => {
        const element = createReplaceElement();
        const config = {method: 0, idPath: ["notebook"], group: 0, sort: 1, page: 2};
        const edit = createProtyleDomainFixture();

        replace({element, config, edit, isAll: false});

        expect(runtime.calls).toEqual(["saveKeyList", "fetchPost"]);
        expect(runtime.saveKeyList).toHaveBeenCalledWith("replaceKeys", "replacement value");
        expect(runtime.fetchPost).toHaveBeenCalledWith("/api/search/findReplace", expect.objectContaining({
            ids: ["current"],
            k: "resolved-key",
            r: "replacement value",
            paths: ["notebook"],
            page: 2,
        }), expect.any(Function));
        expect(element.querySelector("svg")?.classList.contains("fn__none")).toBe(false);

        runtime.callback?.({code: 0});

        expect(element.querySelector("svg")?.classList.contains("fn__none")).toBe(true);
        expect(runtime.inputEvent).toHaveBeenCalledWith(element, config, edit, false, {
            currentId: "current",
            newId: "next",
        });
        expect(runtime.calls).toEqual(["saveKeyList", "fetchPost", "inputEvent"]);
    });
});
