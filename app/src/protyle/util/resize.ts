import {hideElements} from "../ui/hideElements";
import {setPadding} from "../ui/padding";
import {Constants} from "../../constants";
import {lineNumberRender} from "../render/highlightRender";
import {stickyRow} from "../render/av/row";
import {clearProtyleBeforeResizeTop, recordProtyleBeforeResizeTop} from "../runtime/layout.port";

export const clearBeforeResizeTop = () => {
    clearProtyleBeforeResizeTop();
};

export const recordBeforeResizeTop = () => {
    recordProtyleBeforeResizeTop();
};

export const resize = (protyle: IProtyle) => {
    hideElements(["gutterOnly"], protyle);
    const abs = setPadding(protyle);
    const MIN_ABS = 4;
    // 不能 clearTimeout，否则 split 时左侧无法 resize
    setTimeout(() => {
        if (protyle.scroll && protyle.scroll.element.parentElement.getAttribute("style")) {
            protyle.scroll.element.parentElement.setAttribute("style", `--b3-dynamicscroll-width:${Math.min(protyle.contentElement.clientHeight - 49, 200)}px`);
        }
        protyle.wysiwyg.element.querySelectorAll(".av").forEach((item: HTMLElement) => {
            stickyRow(item, protyle.contentElement, "all");
        });
        if (abs.width > MIN_ABS || isNaN(abs.width)) {
            if (typeof window.echarts !== "undefined") {
                protyle.wysiwyg.element.querySelectorAll('[data-subtype="echarts"], [data-subtype="mindmap"]').forEach((chartItem: HTMLElement) => {
                    const chartInstance = window.echarts.getInstanceById(chartItem.querySelector("[_echarts_instance_]").getAttribute("_echarts_instance_"));
                    if (chartInstance) {
                        chartInstance.resize();
                    }
                });
            }
        }
        // 小于 MIN_ABS 也会导致换行 https://github.com/siyuan-note/siyuan/issues/13677
        protyle.wysiwyg.element.querySelectorAll(".code-block .protyle-linenumber__rows").forEach((item: HTMLElement) => {
            if ((item.nextElementSibling as HTMLElement).style.wordBreak === "break-word") {
                lineNumberRender(item.parentElement);
            }
        });
        const topElement = protyle.wysiwyg.element.querySelector("[data-resize-top]");
        if (topElement) {
            topElement.scrollIntoView();
            protyle.contentElement.scrollTop += parseInt(topElement.getAttribute("data-resize-top"));
            topElement.removeAttribute("data-resize-top");
        }
    }, Constants.TIMEOUT_TRANSITION + 100);   // 等待 setPadding 动画结束
};
