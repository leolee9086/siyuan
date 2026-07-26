import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {Window} from "happy-dom";
import {
    genBreadcrumb,
    improveBreadcrumbAppearance,
} from "../../src/protyle/breadcrumb/backlinkBreadcrumb";

const htmlElementDescriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");

afterEach(() => {
    if (htmlElementDescriptor) {
        Object.defineProperty(globalThis, "HTMLElement", htmlElementDescriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, "HTMLElement");
});

describe("backlink breadcrumb rendering", () => {
    it("builds ordered breadcrumb HTML with icons and separators", () => {
        const html = genBreadcrumb([
            {id: "root", name: "Root", type: "NodeDocument"},
            {id: "heading", name: "Heading", type: "NodeHeading", subType: "h2"},
        ], false);

        assert.doesNotMatch(html, /data-id="root"/);
        assert.match(html, /data-id="heading"/);
        assert.match(html, /#iconH2/);
        assert.doesNotMatch(html, /protyle-breadcrumb__arrow/);
    });

    it("compresses overflowing embed labels and keeps the last item visible", () => {
        const testWindow = new Window();
        Object.defineProperty(globalThis, "HTMLElement", {configurable: true, value: testWindow.HTMLElement});
        const container = testWindow.document.createElement("div");
        container.setAttribute("data-type", "NodeBlockQueryEmbed");
        container.innerHTML = `<div class="protyle-breadcrumb__bar protyle-breadcrumb__bar--nowrap">
            <span class="protyle-breadcrumb__text">Root</span>
            <span class="protyle-breadcrumb__text">Parent</span>
            <span class="protyle-breadcrumb__text">Current</span>
        </div>`;
        const bar = container.querySelector(".protyle-breadcrumb__bar");
        assert.ok(bar);
        const lastItem = bar.querySelector(".protyle-breadcrumb__text:last-child");
        assert.ok(lastItem);
        Object.defineProperty(bar, "scrollHeight", {configurable: true, value: 40});
        Object.defineProperty(bar, "clientWidth", {configurable: true, value: 100});
        Object.defineProperty(lastItem, "offsetLeft", {configurable: true, value: 180});

        improveBreadcrumbAppearance(container);

        const labels = bar.querySelectorAll(".protyle-breadcrumb__text");
        assert.equal(labels[0]?.classList.contains("protyle-breadcrumb__text--ellipsis"), false);
        assert.equal(labels[1]?.classList.contains("protyle-breadcrumb__text--ellipsis"), true);
        assert.equal(labels[2]?.classList.contains("protyle-breadcrumb__text--ellipsis"), true);
        assert.equal(bar.scrollLeft, 94);
        assert.equal(bar.classList.contains("protyle-breadcrumb__bar--nowrap"), true);
    });
});
