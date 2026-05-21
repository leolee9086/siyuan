import { Constants } from "../../../constants";
import { hasClosestBlock, hasClosestByClassName } from "../hasClosest";
import { processClonePHElement } from "../../render/util";

export const onDragStart = (protyle: IProtyle, event: DragEvent) => {
    if (protyle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    let target = event.target as HTMLElement;
    if (target.classList?.contains("av__gallery-img")) {
        target = hasClosestByClassName(target, "av__gallery-item") as HTMLElement;
    }
    if (!target) {
        return;
    }
    if (target.tagName === "IMG") {
        window.siyuan.dragElement = undefined;
        event.preventDefault();
        return;
    }

    if (target.classList) {
        if (hasClosestByClassName(target, "protyle-wysiwyg__embed")) {
            window.siyuan.dragElement = undefined;
            event.preventDefault();
        } else if (target.parentElement.parentElement.classList.contains("av__views")) {
            window.siyuan.dragElement = target;
            target.style.width = target.clientWidth + "px";
            target.style.opacity = ".36";
            event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}${[target.previousElementSibling?.getAttribute("data-id")]}`,
                target.outerHTML);
            return;
        } else if (target.classList.contains("protyle-action")) {
            target.parentElement.classList.add("protyle-wysiwyg--select");
            const ghostElement = document.createElement("div");
            ghostElement.className = protyle.wysiwyg.element.className;
            const cloneElement = processClonePHElement(target.parentElement.cloneNode(true) as Element);
            cloneElement.querySelectorAll(".iframe").forEach(item => {
                item.remove();
            });
            ghostElement.append(cloneElement);
            ghostElement.setAttribute("style", `position:fixed;opacity:.1;width:${target.parentElement.clientWidth}px;padding:0;`);
            document.body.append(ghostElement);
            event.dataTransfer.setDragImage(ghostElement, 0, 0);
            if (window.siyuan.touchDragActive) {
                window.siyuan.touchDragGhost = ghostElement;
            } else {
                setTimeout(() => {
                    ghostElement.remove();
                });
            }

            window.siyuan.dragElement = protyle.wysiwyg.element;
            event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}NodeListItem${Constants.ZWSP}${target.parentElement.getAttribute("data-subtype")}${Constants.ZWSP}${[target.parentElement.getAttribute("data-node-id")]}`,
                protyle.wysiwyg.element.innerHTML);
            return;
        } else if (target.classList.contains("av__cell--header")) {
            window.siyuan.dragElement = target;
            event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}Col${Constants.ZWSP}${[target.getAttribute("data-col-id")]}`,
                target.outerHTML);
            return;
        } else if (target.classList.contains("av__gallery-item")) {
            const blockElement = hasClosestBlock(target);
            if (blockElement) {
                if (blockElement.querySelector('.block__icon[data-type="av-sort"]')?.classList.contains("block__icon--active")) {
                    const bodyElements = blockElement.querySelectorAll(".av__body");
                    if (bodyElements.length === 1) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    } else if (["template", "created", "updated"].includes(bodyElements[0].getAttribute("data-dtype"))) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                }
                if (!target.classList.contains("av__gallery-item--select")) {
                    blockElement.querySelectorAll(".av__gallery-item--select").forEach(item => {
                        item.classList.remove("av__gallery-item--select");
                    });
                    target.classList.add("av__gallery-item--select");
                }
                const ghostElement = document.createElement("div");
                ghostElement.className = "protyle-wysiwyg protyle-wysiwyg--attr";
                const isKanban = blockElement.getAttribute("data-av-type") === "kanban";
                if (isKanban) {
                    ghostElement.innerHTML = `<div class="${blockElement.querySelector(".av__kanban").className}"></div>`;
                }
                let galleryElement: HTMLElement;
                let cloneGalleryElement = document.createElement("div");
                const selectElements = blockElement.querySelectorAll(".av__gallery-item--select");
                selectElements.forEach(item => {
                    if (!galleryElement || !galleryElement.contains(item)) {
                        galleryElement = item.parentElement;
                        cloneGalleryElement = document.createElement("div");
                        if (isKanban) {
                            cloneGalleryElement.className = "av__kanban-group";
                            cloneGalleryElement.setAttribute("style", item.parentElement.parentElement.parentElement.getAttribute("style"));
                            cloneGalleryElement.innerHTML = '<div class="av__gallery"></div>';
                            ghostElement.firstElementChild.appendChild(cloneGalleryElement);
                        } else {
                            cloneGalleryElement.classList.add("av__gallery");
                            cloneGalleryElement.setAttribute("style", `width: 100vw;margin-bottom: 16px;grid-template-columns: repeat(auto-fill, ${selectElements[0].clientWidth}px);`);
                            ghostElement.appendChild(cloneGalleryElement);
                        }
                    }
                    const cloneItem = processClonePHElement(item.cloneNode(true) as Element);
                    cloneItem.setAttribute("style", `height:${item.clientHeight}px;`);
                    cloneItem.classList.remove("av__gallery-item--select");
                    if (isKanban) {
                        cloneGalleryElement.firstElementChild.appendChild(cloneItem);
                    } else {
                        cloneGalleryElement.appendChild(cloneItem);
                    }
                });
                ghostElement.setAttribute("style", "left: 1px;top:100vh;position:fixed;opacity:.1;padding:0;z-index: 8");
                document.body.append(ghostElement);
                event.dataTransfer.setDragImage(ghostElement, -10, -10);
                if (window.siyuan.touchDragActive) {
                    window.siyuan.touchDragGhost = ghostElement;
                } else {
                    setTimeout(() => {
                        ghostElement.remove();
                    });
                }
                window.siyuan.dragElement = target;
                const selectIds: string[] = [];
                blockElement.querySelectorAll(".av__gallery-item--select").forEach(item => {
                    const bodyElement = hasClosestByClassName(item, "av__body") as HTMLElement;
                    const groupId = bodyElement.getAttribute("data-group-id");
                    selectIds.push(item.getAttribute("data-id") + (groupId ? `@${groupId}` : ""));
                });
                event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}GalleryItem${Constants.ZWSP}${selectIds}`,
                    ghostElement.outerHTML);
            }
            return;
        }
    }
    // 选中编辑器中的文字进行拖拽
    event.dataTransfer.setData(Constants.SIYUAN_DROP_EDITOR, Constants.SIYUAN_DROP_EDITOR);
    protyle.element.style.userSelect = "auto";
    document.onmousemove = null;
    document.onmouseup = null;
};
