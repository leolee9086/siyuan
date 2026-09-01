import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { getRectImageName, hideRectResizeHandles, moveRectBounds, resizeRectBounds } from "../rectAnnotationResize";
import { PDF_RECT_CAPTURE_PROFILE } from "../pdfRectCapture";

describe("anno dragResize lifecycle pure helpers", () => {
    it("getRectImageName supports optional captureProfile (upstream 3-arg compat)", () => {
        const content = "example-P1-20260809120000-abcdefg";
        // 3-arg upstream form without profile
        assert.equal(getRectImageName(content, 0, "0123456"), "example-P1-20260809120000-0123456.png");
        assert.equal(getRectImageName(content, 90, "7654321"), "example-P1-90-20260809120000-7654321.png");
        // 4-arg local form with profile
        assert.equal(getRectImageName(content, 0, "0123456", PDF_RECT_CAPTURE_PROFILE),
            `example-P1-${PDF_RECT_CAPTURE_PROFILE}-20260809120000-0123456.png`);
        assert.equal(getRectImageName(content, 0, ""), "example-P1-20260809120000-abcdefg.png");
    });

    it("hideRectResizeHandles removes selected and handles", () => {
        let selectedRemoved = false;
        let handleRemoved = false;
        const selected = {
            classList: { remove(c: string) { selectedRemoved = c === "pdf__rect--selected"; } },
            querySelectorAll(sel: string) {
                assert.equal(sel, ".pdf__rect-resize");
                return [{ remove: () => { handleRemoved = true; } }];
            }
        };
        const container = {
            querySelectorAll(sel: string) {
                assert.equal(sel, ".pdf__rect--selected");
                return [selected];
            }
        } as unknown as ParentNode;
        hideRectResizeHandles(container);
        assert.equal(selectedRemoved, true);
        assert.equal(handleRemoved, true);
    });

    it("move/resize pure geometry remains correct", () => {
        const initial = { left: 20, top: 30, right: 80, bottom: 90 };
        const boundary = { left: 0, top: 0, right: 100, bottom: 120 };
        assert.deepEqual(moveRectBounds(initial, boundary, 10, 15), { left: 30, top: 45, right: 90, bottom: 105 });
        assert.deepEqual(resizeRectBounds(initial, boundary, "se", 95, 110, 8), { left: 20, top: 30, right: 95, bottom: 110 });
    });

    it("isRectAnnotationElement logic matches upstream regex", () => {
        // Simulate isRectAnnotationElement from anno.showToolbar
        const isRect = (el: any) => el.dataset.mode === "rect" ||
            (el.dataset.mode === "" && el.childElementCount === 1 && /-P\d+-\d{14}-\w{7}$/.test(el.dataset.content || ""));
        assert.equal(isRect({ dataset: { mode: "rect", content: "foo" }, childElementCount: 2 }), true);
        assert.equal(isRect({ dataset: { mode: "", content: "foo-P1-20260809120000-abcdefg" }, childElementCount: 1 }), true);
        assert.equal(isRect({ dataset: { mode: "", content: "foo-P1-20260809120000-abcdefg" }, childElementCount: 2 }), false);
        assert.equal(isRect({ dataset: { mode: "text", content: "foo" }, childElementCount: 1 }), false);
    });

    it("setRectPosition computes viewport rect correctly", () => {
        // 纯几何：复刻 anno.dragResize 内的 setRectPosition 逻辑，避免加载 constants 依赖
        const setRectPosition = (element: any, page: any, rect: number[], viewport = page.viewport.clone({ rotation: 0 })) => {
            const bounds = viewport.convertToViewportRectangle(rect);
            const width = Math.abs(bounds[0] - bounds[2]);
            if (width <= 0) { return false; }
            element.style.left = `${Math.min(bounds[0], bounds[2])}px`;
            element.style.top = `${Math.min(bounds[1], bounds[3])}px`;
            element.style.width = `${width}px`;
            element.style.height = `${Math.abs(bounds[1] - bounds[3])}px`;
            return true;
        };
        const mockPage = {
            viewport: {
                clone: () => ({
                    convertToViewportRectangle: (rect: number[]) => {
                        const [left = 0, top = 0, right = 0, bottom = 0] = rect;
                        return [left * 2, top * 2, right * 2, bottom * 2] as any;
                    }
                })
            }
        };
        const el: any = { style: {} as any };
        const ok = setRectPosition(el, mockPage, [10, 20, 30, 40]);
        assert.equal(ok, true);
        assert.equal(el.style.left, "20px");
        assert.equal(el.style.top, "40px");
        assert.equal(el.style.width, "40px");
        const el2: any = { style: {} as any };
        const mockPageZero = {
            viewport: { clone: () => ({ convertToViewportRectangle: () => [10, 10, 10, 20] }) }
        };
        assert.equal(setRectPosition(el2, mockPageZero, [5, 5, 5, 10]), false);
    });
});
