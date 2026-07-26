import {describe, expect, it} from "vitest";

import {isIncludeCell} from "../../src/protyle/util/table/selection/geometry";

const setGeometry = (element: HTMLElement, values: {
    offsetLeft: number;
    offsetTop: number;
    clientWidth: number;
    clientHeight: number;
}) => {
    for (const [name, value] of Object.entries(values)) {
        Object.defineProperty(element, name, {configurable: true, value});
    }
};

describe("table selection geometry", () => {
    it("includes a cell whose inset bounds are inside the scrolled selection", () => {
        const selection = document.createElement("div");
        const cell = document.createElement("td");
        setGeometry(selection, {offsetLeft: 10, offsetTop: 20, clientWidth: 100, clientHeight: 80});
        setGeometry(cell, {offsetLeft: 25, offsetTop: 35, clientWidth: 40, clientHeight: 30});

        expect(isIncludeCell({tableSelectElement: selection, scrollLeft: 5, scrollTop: 5, item: cell})).toBe(true);
    });

    it("excludes a cell whose inset edge touches the selection boundary", () => {
        const selection = document.createElement("div");
        const cell = document.createElement("td");
        setGeometry(selection, {offsetLeft: 10, offsetTop: 20, clientWidth: 100, clientHeight: 80});
        setGeometry(cell, {offsetLeft: 4, offsetTop: 20, clientWidth: 40, clientHeight: 30});

        expect(isIncludeCell({tableSelectElement: selection, scrollLeft: 0, scrollTop: 0, item: cell})).toBe(false);
    });
});
