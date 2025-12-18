import { Constants } from "../../../constants";
import { hideTooltip } from "../../../dialog/tooltip";
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
import { isTouchDevice } from "../../../util/functions";
import { getSelection } from "../../../util/DOM/range";
import { setSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { Files } from "../Files";

export const onDragStart = (files: Files, event: DragEvent & { target: HTMLElement; }) => {
    if (isTouchDevice()) {
        event.stopPropagation();
        event.preventDefault();
        return;
    }
    getSelection().removeAllRanges();
    hideTooltip();
    const liElement = hasClosestByTag(event.target, "LI");
    if (!liElement) {
        return;
    }
    files.parent.panelElement.classList.add("sy__file--disablehover");
    let selectElements = Array.from(files.element.querySelectorAll(".b3-list-item--focus")) as HTMLElement[];
    if (!liElement.classList.contains("b3-list-item--focus")) {
        for (const item of selectElements) {
            item.classList.remove("b3-list-item--focus");
        }
        liElement.classList.add("b3-list-item--focus");
        selectElements = [liElement];
    }
    const idList: string[] = [];
    const ghostElement = document.createElement("ul");
    for (const item of selectElements) {
        ghostElement.append(item.cloneNode(true));
        item.style.opacity = "0.38";
        const itemNodeId = item.dataset.nodeId ||
            item.dataset.path; // 拖拽笔记本时值不能为空，否则 drop 就不会继续排序
        if (itemNodeId) {
            idList.push(itemNodeId);
        }
    }
    const ids = idList.join(",");
    ghostElement.setAttribute("style", `width: 219px;position: fixed;top:-${selectElements.length * 30}px`);
    ghostElement.setAttribute("class", "b3-list b3-list--background");
    document.body.append(ghostElement);
    if (event.dataTransfer) {
        event.dataTransfer.setDragImage(ghostElement, 16, 16);
        event.dataTransfer.setData(Constants.SIYUAN_DROP_FILE, ids);
        event.dataTransfer.dropEffect = "move";
    }
    const dragElement = document.createElement("div");
    setSiyuanDragElement(dragElement);
    dragElement.innerText = ids;
    setTimeout(() => {
        ghostElement.remove();
    });
};
