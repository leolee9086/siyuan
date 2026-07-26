import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {Window} from "happy-dom";
import {createDragFillStep} from "../../src/protyle/render/av/cell/dragFill/dragFill.step";

const testWindow = new Window();

const createTarget = (type, detached = false) => {
    const element = testWindow.document.createElement("div");
    if (detached) {
        element.setAttribute("data-detached", "true");
    }
    return {
        id: "target-cell",
        type,
        colId: "column-id",
        element,
        text: {content: "target"},
    };
};

describe("AV cell drag fill step", () => {
    it("deep clones source data and creates matching do and undo operations", () => {
        const source = {
            id: "source-cell",
            type: "text",
            text: {content: "source"},
        };
        const target = createTarget("text");

        const step = createDragFillStep({target, source, avID: "av-id", rowID: "row-id"});

        assert.ok(step);
        assert.notEqual(step.data, source);
        assert.notEqual(step.data.text, source.text);
        assert.deepEqual(step.data, {...source, id: "target-cell"});
        assert.deepEqual(step.doOperation, {
            action: "updateAttrViewCell",
            id: "target-cell",
            avID: "av-id",
            keyID: "column-id",
            rowID: "row-id",
            data: step.data,
        });
        assert.deepEqual(step.undoOperation, {
            action: "updateAttrViewCell",
            id: "target-cell",
            avID: "av-id",
            keyID: "column-id",
            rowID: "row-id",
            data: target,
        });
        assert.equal(source.id, "source-cell");
        assert.equal(source.text.content, "source");
    });

    it("does not create operations for readonly column types", () => {
        for (const type of ["rollup", "template", "created", "updated"]) {
            assert.equal(createDragFillStep({
                target: createTarget(type),
                avID: "av-id",
                rowID: "row-id",
            }), undefined);
        }
    });

    it("does not overwrite a block target that is not detached", () => {
        const source = {id: "source-cell", type: "block", block: {id: "source-block"}};

        assert.equal(createDragFillStep({
            target: createTarget("block"),
            source,
            avID: "av-id",
            rowID: "row-id",
        }), undefined);
    });

    it("detaches copied block data without changing its source", () => {
        const source = {
            id: "source-cell",
            type: "block",
            block: {id: "source-block", content: "source"},
        };
        const target = createTarget("block", true);

        const step = createDragFillStep({target, source, avID: "av-id", rowID: "row-id"});

        assert.ok(step);
        assert.equal(step.data.id, "target-cell");
        assert.equal(step.data.isDetached, true);
        assert.deepEqual(step.data.block, {content: "source"});
        assert.deepEqual(source.block, {id: "source-block", content: "source"});
        assert.notEqual(step.data.block, source.block);
    });
});
