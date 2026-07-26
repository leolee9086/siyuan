import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {Window} from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.SIYUAN_VERSION = "test";
globalThis.NODE_ENV = "test";

window.siyuan = {
    languages: {
        hideCol: "Hidden fields",
        showAll: "Show all",
        fields: "Fields",
        showCol: "Visible fields",
        hideAll: "Hide all",
        new: "New field",
    },
};

const {getPropertiesHTML} = await import("../../src/protyle/render/av/col/properties/render");

describe("AV properties panel", () => {
    it("renders the shared implementation without mutating fields", () => {
        const fields = [
            {id: "visible", icon: "", name: "Visible <field>", hidden: false, type: "text"},
            {id: "hidden", icon: "", name: "Hidden & field", hidden: true, type: "number"},
        ];
        const snapshot = structuredClone(fields);

        const html = getPropertiesHTML(fields);

        assert.match(html, /Fields/);
        assert.match(html, /Visible &lt;field>/);
        assert.match(html, /Hidden &amp; field/);
        assert.match(html, /Hidden fields/);
        assert.match(html, /data-type="showAllCol"/);
        assert.match(html, /data-type="hideAllCol"/);
        assert.deepEqual(fields, snapshot);
    });
});
