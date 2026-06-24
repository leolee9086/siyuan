import { Files } from "../Files";
import { Constants } from "../../../constants";
import { showTooltip } from "../../../dialog/tooltip";
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { hideDragTip } from "../../../protyle/util/dragTip";
import { setSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { ipcSend } from "../../../platform/electron/ipcRenderer";
import { isElectron } from "../../../platform";

export const onDragEnd = (files: Files, event: DragEvent) => {
    files.parent.panelElement.classList.remove("sy__file--disablehover");
    const opacityItems = files.element.querySelectorAll('.b3-list-item[style*="opacity: 0.38;"]');
    for (const [index, item] of Array.from(opacityItems).entries()) {
        if (!(item instanceof HTMLElement)) {
            continue;
        }
        item.style.opacity = "";
        // https://github.com/siyuan-note/siyuan/issues/11587
        if (index !== 0) {
            continue;
        }

        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        if (!targetElement || !hasClosestByClassName(targetElement, "sy__file")) {
            continue;
        }

        const ariaLabelElement = item.querySelector(".ariaLabel");
        const ariaLabel = ariaLabelElement?.getAttribute("aria-label");
        if (ariaLabelElement && ariaLabel) {
            showTooltip(ariaLabel, ariaLabelElement);
        }
    }
    setSiyuanDragElement(undefined);
    hideDragTip();
    window.siyuan.dragTitle = "";
    if (isElectron) {
        ipcSend(Constants.SIYUAN_SEND_WINDOWS, { cmd: "resetTabsStyle", data: "rmDragStyle" });
        return;
    }
    const dragTabs = document.querySelectorAll(".layout-tab-bars--drag");
    for (const item of Array.from(dragTabs)) {
        item.classList.remove("layout-tab-bars--drag");
    }
};
