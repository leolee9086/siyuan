import {describe, expect, it, vi} from "vitest";

const responseState = vi.hoisted(() => ({rootID: "root-id"}));

vi.mock("../../../src/block/panel/editor/imports", () => ({
    Constants: {CB_GET_ALL: "all", CB_GET_CONTEXT: "context", CB_GET_BACKLINK: "backlink"},
    fetchPost: (_url: string, _data: unknown, callback: (response: IWebSocketData) => void) => callback({
        code: 0,
        data: {rootID: responseState.rootID},
    } as IWebSocketData),
    showMessage: vi.fn(),
    getWindowInnerHeight: () => 900,
}));

import {初始化Protyle编辑器} from "../../../src/block/panel/Panel.editor";
import {createProtyleDomainFixture} from "../../support/protyleDomain.fixture";
import {createWYSIWYGDomainFixture} from "../../support/wysiwygDomain.fixture";

/** 验证异步编辑器加载完成后仍调用宿主注入的数据库条目定位动作。 */
describe("BlockPanel editor initialization", () => {
    it("forwards AV location through the editor context", () => {
        const editorElement = document.createElement("div");
        editorElement.dataset.index = "0";
        document.body.append(editorElement);
        const locateAttributeView = vi.fn();
        const renderAttributeView = vi.fn(async () => undefined);
        const protyleElement = document.createElement("div");
        const protyle = {
            element: protyleElement,
            contentElement: document.createElement("div"),
            wysiwyg: createWYSIWYGDomainFixture(),
        };
        const editor = createProtyleDomainFixture(protyle);
        editor.destroy = vi.fn();
        const editors: typeof editor[] = [];
        let renderOptions: IProtyleOptions["render"] | undefined;

        初始化Protyle编辑器(editorElement, {
            createEditor: (_element, options) => {
                renderOptions = options.render;
                options.after(editor);
                return editor;
            },
            locateAttributeView,
            renderAttributeView,
            refDefs: [{refID: "block-id", avItemID: "item-id", avViewID: "view-id", avGroupID: "group-id"}],
            isBacklink: false,
            targetElement: document.createElement("div"),
            editors,
        });

        expect(locateAttributeView).toHaveBeenCalledWith({
            renderAV: renderAttributeView,
            protyle,
            blockID: "block-id",
        }, {
            itemID: "item-id",
            viewID: "view-id",
            groupID: "group-id",
            select: false,
            highlight: true,
            persistView: false,
        });
        expect(editors).toContain(editor);
        expect(renderOptions).toMatchObject({background: false, title: false});
        editorElement.remove();
    });
});
