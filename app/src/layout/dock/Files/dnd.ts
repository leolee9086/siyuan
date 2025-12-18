
import { Files } from "../Files";
import { Constants } from "../../../constants";
import { showTooltip } from "../../../dialog/tooltip";
import {
    hasClosestByClassName
} from "../../../protyle/util/hasClosest";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { onDragStart } from "./dnd.onDragStart";
import { onDragOver } from "./dnd.onDragOver";
import { onDrop } from "./dnd.onDrop";

export const initFilesDrag = (files: Files) => {
    files.element.addEventListener("dragstart", (event: DragEvent & { target: HTMLElement }) => {
        onDragStart(files, event);
    });
    files.element.addEventListener("dragend", (event) => {
        files.parent.panelElement.classList.remove("sy__file--disablehover");
        files.element.querySelectorAll('.b3-list-item[style*="opacity: 0.38;"]').forEach((item: HTMLElement, index) => {
            item.style.opacity = "";
            // https://github.com/siyuan-note/siyuan/issues/11587
            if (index === 0 && hasClosestByClassName(document.elementFromPoint(event.clientX, event.clientY), "sy__file")) {
                const ariaLabelElement = item.querySelector(".ariaLabel");
                if (ariaLabelElement) {
                    showTooltip(ariaLabelElement.getAttribute("aria-label"), ariaLabelElement);
                }
            }
        });
        window.siyuan.dragElement = undefined;
        /// #if !BROWSER
        ipcRenderer.send(Constants.SIYUAN_SEND_WINDOWS, { cmd: "resetTabsStyle", data: "rmDragStyle" });
        /// #else
        document.querySelectorAll(".layout-tab-bars--drag").forEach(item => {
            item.classList.remove("layout-tab-bars--drag");
        });
        /// #endif
    });
    files.element.addEventListener("dragover", (event: DragEvent & { target: HTMLElement }) => {
        onDragOver(files, event);
    });
    let counter = 0;
    files.element.addEventListener("dragleave", () => {
        counter--;
        if (counter === 0) {
            files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top").forEach((item: HTMLElement) => {
                item.classList.remove("dragover", "dragover__bottom", "dragover__top");
            });
        }
    });
    files.element.addEventListener("dragenter", (event) => {
        event.preventDefault();
        counter++;
    });
    files.element.addEventListener("drop", async (event: DragEvent & { target: HTMLElement }) => {
        counter = 0;
        await onDrop(files, event);
    });
};
