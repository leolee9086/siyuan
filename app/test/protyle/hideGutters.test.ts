import {after, before, describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {hideAllGutters} from "../../src/protyle/ui/hideGutters";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

describe("hideAllGutters", () => {
    const gutter = {
        innerHTML: "content",
        classList: {
            values: new Set<string>(),
            add(value: string) {
                this.values.add(value);
            },
        },
    };

    before(() => {
        Object.defineProperty(globalThis, "document", {
            configurable: true,
            value: {
                querySelectorAll: (selector: string) => selector === ".protyle-gutters" ? [gutter] : [],
            },
        });
    });

    after(() => {
        if (originalDocument) {
            Object.defineProperty(globalThis, "document", originalDocument);
            return;
        }
        Reflect.deleteProperty(globalThis, "document");
    });

    it("hides and clears every gutter", () => {
        hideAllGutters();
        assert.equal(gutter.classList.values.has("fn__none"), true);
        assert.equal(gutter.innerHTML, "");
    });
});
