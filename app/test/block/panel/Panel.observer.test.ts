import {afterEach, describe, expect, it, vi} from "vitest";

import {绑定滚动事件, 设置观察器} from "../../../src/block/panel/Panel.observer";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

/** 验证观察器只负责调度，由 BlockPanel 组合边界提供具体编辑器动作。 */
describe("BlockPanel observers", () => {
    it("dispatches resize and lazy initialization through injected actions", () => {
        vi.useFakeTimers();
        let resizeCallback: ResizeObserverCallback | undefined;
        let intersectionCallback: IntersectionObserverCallback | undefined;
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback;
            }
            observe() {}
        });
        vi.stubGlobal("IntersectionObserver", class {
            constructor(callback: IntersectionObserverCallback) {
                intersectionCallback = callback;
            }
            observe() {}
        });
        const protyle = {element: document.createElement("div")};
        const resizeEditor = vi.fn();
        const initProtyle = vi.fn();
        const target = document.createElement("div");

        设置观察器({
            element: document.createElement("div"),
            editors: [{protyle, destroy: vi.fn()}],
            initProtyle,
            resizeEditor,
        });
        resizeCallback?.([], {} as ResizeObserver);
        vi.runAllTimers();
        intersectionCallback?.([{isIntersecting: true, target}] as IntersectionObserverEntry[], {} as IntersectionObserver);

        expect(resizeEditor).toHaveBeenCalledWith(protyle);
        expect(initProtyle).toHaveBeenCalledWith(target);
    });

    it("dispatches gutter hiding when panel content scrolls", () => {
        const element = document.createElement("div");
        const content = document.createElement("div");
        content.className = "block__content";
        element.append(content);
        const protyle = {element: document.createElement("div")};
        const hideGutter = vi.fn();

        绑定滚动事件({element, editors: [{protyle, destroy: vi.fn()}], hideGutter});
        content.dispatchEvent(new Event("scroll"));

        expect(hideGutter).toHaveBeenCalledWith(protyle);
    });
});
