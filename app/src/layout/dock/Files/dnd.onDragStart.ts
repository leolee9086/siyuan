import { Constants } from "../../../constants";
import { hideTooltip } from "../../../dialog/tooltip";
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
import { getSelection } from "../../../util/DOM/selection/range.global";
import { setSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement } from "../../../util/DOM/element.guard";
import { Files } from "../Files";

export const onDragStart = (files: Files, event: DragEvent) => {
    if (window.siyuan.config.readonly) {
        return;
    }
    const target = event.target;
    if (!isStylableElement(target)) {
        return;
    }
    getSelection().removeAllRanges();
    hideTooltip();
    const liElement = hasClosestByTag(target, "LI");
    if (!liElement) {
        return;
    }
    files.parent.panelElement.classList.add("sy__file--disablehover");
    let selectElements = Array.from(files.element.querySelectorAll<HTMLElement>(".b3-list-item--focus"));
    if (!liElement.classList.contains("b3-list-item--focus")) {
        for (const item of selectElements) {
            item.classList.remove("b3-list-item--focus");
        }
        liElement.classList.add("b3-list-item--focus");
        selectElements = [liElement];
    }
    const { ghostElement, ids } = 创建拖拽预览(selectElements);
    if (event.dataTransfer) {
        event.dataTransfer.setDragImage(ghostElement, 16, 16);
        event.dataTransfer.setData(Constants.SIYUAN_DROP_FILE, ids);
        event.dataTransfer.dropEffect = "move";
    }
    const dragElement = document.createElement("div");
    setSiyuanDragElement(dragElement);
    dragElement.innerText = ids;
    if (window.siyuan.touchDragActive) {
        window.siyuan.touchDragGhost = ghostElement;
    } else {
        setTimeout(() => {
            ghostElement.remove();
        });
    }
};
