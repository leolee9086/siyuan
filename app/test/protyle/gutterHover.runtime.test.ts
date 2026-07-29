import {describe, expect, it, vi} from "vitest";
import {绑定悬停事件} from "../../src/protyle/ui/event";

describe("Protyle gutter hover", () => {
    it("resolves the highlighted block through the shared gutter node resolver", () => {
        const root = document.createElement("div");
        const wysiwygElement = document.createElement("div");
        const blockElement = document.createElement("div");
        blockElement.dataset.nodeId = "block-1";
        wysiwygElement.appendChild(blockElement);

        const gutterElement = document.createElement("div");
        gutterElement.className = "protyle-gutters";
        const gutterButton = document.createElement("button");
        gutterButton.dataset.nodeId = "block-1";
        gutterElement.appendChild(gutterButton);
        root.append(wysiwygElement, gutterElement);

        const protyle = Object.assign({} as IProtyle, {
            element: root,
            options: {render: {gutter: true}},
            wysiwyg: {element: wysiwygElement},
            gutter: {
                element: gutterElement,
                isMatchNode: vi.fn(() => true),
                render: vi.fn(),
            },
            selectElement: document.createElement("div"),
        });

        绑定悬停事件(protyle);

        expect(() => gutterButton.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}))).not.toThrow();
        expect(blockElement.classList.contains("protyle-wysiwyg--hl")).toBe(true);
    });
});
