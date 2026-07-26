import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {getPropertiesHTMLWithDeps} from "../../src/protyle/render/av/openMenuPanel.properties";

const createDependencies = (marker) => ({
    unicode2Emoji: (unicode) => `${marker}:emoji:${unicode}`,
    escapeHtml: (html) => `${marker}:escaped:${html}`,
    siyuanI18n: {
        hideCol: `${marker}:hideCol`,
        showAll: `${marker}:showAll`,
        fields: `${marker}:fields`,
        showCol: `${marker}:showCol`,
        hideAll: `${marker}:hideAll`,
        new: `${marker}:new`,
    },
});

describe("AV properties panel", () => {
    it("uses call-local render dependencies without mutating fields", () => {
        const fields = [
            {id: "visible", icon: "", name: "Visible", hidden: false, type: "text"},
            {id: "hidden", icon: "custom", name: "Hidden", hidden: true, type: "number"},
        ];
        const snapshot = structuredClone(fields);

        const firstHTML = getPropertiesHTMLWithDeps(fields, createDependencies("first"));
        const secondHTML = getPropertiesHTMLWithDeps(fields, createDependencies("second"));

        assert.match(firstHTML, /first:fields/);
        assert.match(firstHTML, /first:escaped:Visible/);
        assert.match(firstHTML, /first:emoji:custom/);
        assert.match(secondHTML, /second:fields/);
        assert.doesNotMatch(secondHTML, /first:/);
        assert.deepEqual(fields, snapshot);
    });
});
