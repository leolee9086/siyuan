import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {getFieldsByData, getViewIcon} from "../../src/protyle/render/av/view/metadata";
import {getViewName} from "../../src/protyle/render/av/view/name/resolve";

describe("AV view metadata", () => {
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            siyuan: {
                config: {lang: "en_US"},
                languages: {
                    gallery: "Gallery",
                    kanban: "Board",
                    table: "Table",
                },
            },
        },
    });

    it("returns the complete built-in view icon mapping", () => {
        assert.equal(getViewIcon("table"), "iconTable");
        assert.equal(getViewIcon("gallery"), "iconGallery");
        assert.equal(getViewIcon("kanban"), "iconBoard");
        assert.equal(getViewIcon("future-view"), undefined);
    });

    it("selects table columns and card fields without copying them", () => {
        const columns = [{id: "table-column"}];
        const fields = [{id: "card-field"}];
        assert.equal(getFieldsByData({viewType: "table", view: {columns}}), columns);
        assert.equal(getFieldsByData({viewType: "gallery", view: {fields}}), fields);
        assert.equal(getFieldsByData({viewType: "kanban", view: {fields}}), fields);
    });

    it("returns the complete built-in view name mapping", () => {
        assert.equal(getViewName("table"), "Table");
        assert.equal(getViewName("gallery"), "Gallery");
        assert.equal(getViewName("kanban"), "Board");
        assert.equal(getViewName("future-view"), undefined);
    });
});
