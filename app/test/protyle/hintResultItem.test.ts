import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

let genHintItemHTML: typeof import("../../src/protyle/hint/result/item").genHintItemHTML;

before(async () => {
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            siyuan: {
                config: {lang: "en_US"},
                languages: {ref: "References"},
            },
        },
    });
    ({genHintItemHTML} = await import("../../src/protyle/hint/result/item"));
});

const block = (properties: Partial<IBlock> = {}): IBlock => ({
    alias: "",
    content: "Content",
    hPath: "/Notebook/Document",
    ial: {},
    id: "block-id",
    memo: "",
    name: "",
    refCount: 0,
    type: "NodeParagraph",
    ...properties,
} as IBlock);

describe("hint result item renderer", () => {
    it("rejects a block without a type", () => {
        assert.throws(() => genHintItemHTML(block({type: ""})), /Block type is undefined/);
    });

    it("renders the block icon, content and path", () => {
        const html = genHintItemHTML(block());

        assert.match(html, /data-id="block-id"><use xlink:href="#iconParagraph">/);
        assert.match(html, /data-node-id="block-id"/);
        assert.match(html, />Content<\/span>/);
        assert.match(html, />\/Notebook\/Document<\/div>$/);
    });

    it("renders a document emoji with the popover block identity", () => {
        const html = genHintItemHTML(block({ial: {icon: "1f600"}, type: "NodeDocument"}));

        assert.match(html, /<span class="b3-list-item__graphic popover__block" data-id="block-id">😀<\/span>/);
    });

    it("keeps search highlighting but escapes block metadata markup", () => {
        const html = genHintItemHTML(block({
            alias: "<alias>",
            content: "<mark>match</mark>",
            memo: "<memo>",
            name: "<mark>name</mark><name>",
            refCount: 3,
        }));

        assert.match(html, /#iconN.*<mark>name<\/mark>&lt;name>/);
        assert.match(html, /#iconA.*&lt;alias>/);
        assert.match(html, /#iconM.*&lt;memo>/);
        assert.doesNotMatch(html, /<name>|<alias>|<memo>/);
        assert.match(html, /aria-label="References">3<\/span>/);
        assert.match(html, /<span class="b3-list-item__text"><mark>match<\/mark><\/span>/);
    });
});
