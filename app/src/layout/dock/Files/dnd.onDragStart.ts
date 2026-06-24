import { Constants } from "../../../constants";
import { hideTooltip } from "../../../dialog/tooltip";
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
import { transparentImgSrc } from "../../../protyle/util/dragTip";
import { getSelection } from "../../../util/DOM/selection/range.global";
import { setSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement } from "../../../util/DOM/element.guard";
import { Files } from "../Files";

const createDragPreview = (selectElements: HTMLElement[]) => {
    const ghostElement = document.createElement("ul");
    const ids: string[] = [];
    for (const item of selectElements) {
        item.style.opacity = "0.38";
        const id = item.dataset.nodeId || item.dataset.path;
        if (id) {
            ids.push(id);
        }
        ghostElement.append(item.cloneNode(true));
    }
    ghostElement.setAttribute("style", `width: 219px;position: fixed;top:-${selectElements.length * 30}px`);
    ghostElement.setAttribute("class", "b3-list b3-list--background");
    document.body.append(ghostElement);
    return { ghostElement, ids: ids.join(",") };
};

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
    const { ghostElement, ids } = createDragPreview(selectElements);
    if (event.dataTransfer) {
        if (window.siyuan.touchDragActive) {
            // 触屏保留 DOM ghost 供 touchDragBridge 跟随手指。
            event.dataTransfer.setDragImage(ghostElement, 16, 16);
        } else {
            // 桌面端隐藏原生 ghost，改用全局自定义拖拽提示。
            const transparentImg = new Image();
            transparentImg.src = transparentImgSrc;
            event.dataTransfer.setDragImage(transparentImg, 0, 0);
        }
        event.dataTransfer.setData(Constants.SIYUAN_DROP_FILE, ids);
        event.dataTransfer.dropEffect = "move";
    }
    window.siyuan.dragTitle = selectElements[0]?.querySelector(".b3-list-item__text")?.textContent?.trim() || "";
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
