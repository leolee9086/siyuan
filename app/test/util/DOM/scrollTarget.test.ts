import {beforeEach, describe, expect, it, vi} from "vitest";
import {scrollTargetIntoView} from "../../../src/util/DOM/scrollTarget";

const rect = (top: number, bottom: number, height = bottom - top): DOMRect => ({
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height,
    toJSON: () => ({}),
});

describe("scrollTargetIntoView", () => {
    let container: HTMLElement;
    let target: HTMLElement;
    let scroll: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        container = document.createElement("div");
        target = document.createElement("div");
        scroll = vi.fn();
        container.scroll = scroll;
        Object.defineProperty(container, "scrollTop", {value: 40, writable: true});
        container.getBoundingClientRect = () => rect(100, 500, 400);
    });

    it("preserves the existing center calculation", () => {
        target.getBoundingClientRect = () => rect(350, 390, 40);

        scrollTargetIntoView(container, target, {position: "center", behavior: "auto"});

        expect(scroll).toHaveBeenCalledWith({top: 90, behavior: "auto"});
    });

    it("requires and applies the caller-owned start spacing", () => {
        target.getBoundingClientRect = () => rect(250, 290, 40);

        scrollTargetIntoView(container, target, {position: "start", behavior: "smooth", topSpacing: 76});

        expect(scroll).toHaveBeenCalledWith({top: 114, behavior: "smooth"});
    });

    it("does not scroll a target already visible in nearest mode", () => {
        target.getBoundingClientRect = () => rect(200, 260, 60);

        scrollTargetIntoView(container, target, {position: "nearest", behavior: "auto"});

        expect(scroll).not.toHaveBeenCalled();
    });

    it("scrolls to the nearest edge above and below the viewport", () => {
        target.getBoundingClientRect = () => rect(20, 80, 60);
        scrollTargetIntoView(container, target, {position: "nearest", behavior: "auto"});
        expect(scroll).toHaveBeenLastCalledWith({top: -40, behavior: "auto"});

        target.getBoundingClientRect = () => rect(540, 600, 60);
        scrollTargetIntoView(container, target, {position: "nearest", behavior: "smooth"});
        expect(scroll).toHaveBeenLastCalledWith({top: 140, behavior: "smooth"});
    });

    it("aligns an oversized target below the viewport by its top edge", () => {
        target.getBoundingClientRect = () => rect(540, 1040, 500);

        scrollTargetIntoView(container, target, {position: "nearest", behavior: "auto"});

        expect(scroll).toHaveBeenCalledWith({top: 480, behavior: "auto"});
    });
});
