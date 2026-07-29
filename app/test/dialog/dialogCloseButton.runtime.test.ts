import {beforeEach, describe, expect, it, vi} from "vitest";
import {绑定对话框事件} from "../../src/dialog/dialogHelpers.events";
import {
    生成关闭按钮HTML,
    生成全屏按钮HTML,
    计算标题栏样式,
} from "../../src/dialog/dialogHelpers.html";
import type {IDialog} from "../../src/dialog/dialog.types";

describe("Dialog close button rendering", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    it("renders the default outside close button on desktop", () => {
        const html = 生成关闭按钮HTML({
            disableClose: false,
            hideCloseIcon: false,
            closeButtonPosition: "outside",
            hasTitle: true,
        });

        expect(html).toContain("b3-dialog__close");
        expect(html).toContain("#iconCloseRound");
    });

    it("keeps explicit close suppression authoritative", () => {
        const html = 生成关闭按钮HTML({
            disableClose: true,
            hideCloseIcon: false,
            closeButtonPosition: "outside",
            hasTitle: true,
        });

        expect(html).toBe("");
    });

    it("places fullscreen to the left of an outside close button", () => {
        const fullscreenHtml = 生成全屏按钮HTML(true, "outside", true);

        expect(fullscreenHtml).toContain("right: 42px");
        expect(计算标题栏样式(true, "outside", true)).toContain("padding-right: 82px");
    });

    it("does not reserve close-button space when the close button is hidden", () => {
        const fullscreenHtml = 生成全屏按钮HTML(true, "outside", false);

        expect(fullscreenHtml).toContain("right: 10px");
        expect(计算标题栏样式(true, "outside", false)).toContain("padding-right: 50px");
    });

    it("binds the rendered close button to the current dialog lifecycle", () => {
        const element = document.createElement("div");
        element.innerHTML = '<svg class="b3-dialog__close"><use xlink:href="#iconCloseRound"></use></svg>';
        const destroy = vi.fn();
        const dialog = {
            destroy,
            fullscreen: vi.fn(),
        } as unknown as IDialog;
        绑定对话框事件(dialog, element, false, true, () => false);

        element.querySelector<SVGElement>(".b3-dialog__close")?.dispatchEvent(new MouseEvent("click", {bubbles: true}));

        expect(destroy).toHaveBeenCalledOnce();
    });
});
