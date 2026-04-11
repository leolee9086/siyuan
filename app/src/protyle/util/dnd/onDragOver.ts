import { Constants } from "../../../constants";
import { dragoverTab } from "../../render/av/view";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasClosestByTag, hasTopClosestByAttribute, isInEmbedBlock } from "../hasClosest";
import { addDragFill } from "../../render/av/cell";
import { clearSelect } from "../clearSelect";
import { addDragover, clearDragoverElement } from "./util";
import { IDndState } from "./onDrop.types";

export const onDragOver = (protyle: IProtyle, editorElement: HTMLElement, event: DragEvent & { target: HTMLElement }, state: IDndState) => {
    if (protyle.disabled || event.dataTransfer.types.includes(Constants.SIYUAN_DROP_EDITOR)) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "none";
        return;
    }
    let gutterType = "";
    for (const item of event.dataTransfer.items) {
        if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            gutterType = item.type;
        }
    }
    if (gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}`.toLowerCase())) {
        dragoverTab(event);
        event.preventDefault();
        return;
    }
    const contentRect = protyle.contentElement.getBoundingClientRect();
    if (!hasClosestByClassName(event.target, "av__cell") &&
        (event.clientY < contentRect.top + Constants.SIZE_SCROLL_TB || event.clientY > contentRect.bottom - Constants.SIZE_SCROLL_TB)) {
        protyle.contentElement.scroll({
            top: protyle.contentElement.scrollTop + (event.clientY < contentRect.top + Constants.SIZE_SCROLL_TB ? -Constants.SIZE_SCROLL_STEP : Constants.SIZE_SCROLL_STEP),
            behavior: "smooth"
        });
    }
    let targetElement: HTMLElement | false;
    // 设置了的话 drop 就无法监听 shift/control event.dataTransfer.dropEffect = "move";
    if (event.dataTransfer.types.includes("Files")) {
        targetElement = hasClosestByClassName(event.target, "av__cell");
        if (targetElement && targetElement.getAttribute("data-dtype") === "mAsset" &&
            !targetElement.classList.contains("av__cell--header")) {
            event.preventDefault(); // 不使用导致无法触发 drop
            if (state.dragoverElement && targetElement === state.dragoverElement) {
                return;
            }
            const blockElement = hasClosestBlock(targetElement);
            if (blockElement) {
                clearSelect(["cell", "row"], protyle.wysiwyg.element);
                targetElement.classList.add("av__cell--select");
                if (blockElement.getAttribute("data-av-type") !== "gallery") {
                    addDragFill(targetElement);
                }
                state.dragoverElement = targetElement;
            }
        }
        // 使用 event.preventDefault(); 会导致无光标 https://github.com/siyuan-note/siyuan/issues/12857
        return;
    }

    if (!gutterType && !window.siyuan.dragElement) {
        // https://github.com/siyuan-note/siyuan/issues/6436
        event.preventDefault();
        return;
    }
    const gutterTypes = gutterType ? gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP) : [];
    const fileTreeIds = (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE) && window.siyuan.dragElement) ? window.siyuan.dragElement.innerText : "";
    if (event.shiftKey || (event.altKey && fileTreeIds.indexOf("-") === -1)) {
        const targetAssetElement = hasClosestBlock(event.target);
        if (targetAssetElement) {
            targetAssetElement.classList.remove("dragover__top", "protyle-wysiwyg--select", "dragover__bottom", "dragover__left", "dragover__right");
            targetAssetElement.removeAttribute("select-start");
            targetAssetElement.removeAttribute("select-end");
        } else {
            // https://github.com/siyuan-note/siyuan/issues/14177
            editorElement.querySelectorAll(".dragover__top, .protyle-wysiwyg--select, .dragover__bottom, .dragover__left, .dragover__right").forEach((item: HTMLElement) => {
                item.classList.remove("dragover__top", "protyle-wysiwyg--select", "dragover__bottom", "dragover__left", "dragover__right");
                item.removeAttribute("select-start");
                item.removeAttribute("select-end");
            });
        }
        event.preventDefault();
        return;
    }
    // 编辑器内文字拖拽或资源文件拖拽或按住 alt/shift 拖拽反链图标进入编辑器时不能运行 event.preventDefault()， 否则无光标; 需放在 !window.siyuan.dragElement 之后
    event.preventDefault();
    targetElement = hasClosestByClassName(event.target, "av__gallery-item") || hasClosestByClassName(event.target, "av__gallery-add") ||
        hasClosestByClassName(event.target, "av__row") || hasClosestByClassName(event.target, "av__row--util") ||
        hasClosestBlock(event.target);
    if (targetElement && ["gallery", "kanban"].includes(targetElement.getAttribute("data-av-type")) && event.target.classList.contains("av__gallery")) {
        // 拖拽到属性视图 gallery 内，但没选中 item
        return;
    }
    const point = { x: event.clientX, y: event.clientY, className: "" };

    // 超级块中有a，b两个段落块，移动到 ab 之间的间隙 targetElement 会变为超级块，需修正为 a
    if (targetElement && (targetElement.classList.contains("bq") || targetElement.classList.contains("sb") || targetElement.classList.contains("list") || targetElement.classList.contains("li"))) {
        let prevElement = hasClosestBlock(document.elementFromPoint(point.x, point.y - 6));
        while (prevElement && targetElement.contains(prevElement)) {
            if (prevElement.nextElementSibling?.getAttribute("data-node-id")) {
                targetElement = prevElement;
            }
            prevElement = prevElement.parentElement;
        }
    }

    if (!targetElement) {
        if (event.clientY > editorElement.lastElementChild.getBoundingClientRect().bottom) {
            // 命中底部
            targetElement = editorElement.lastElementChild as HTMLElement;
            point.className = "dragover__bottom";
        } else if (event.clientY < editorElement.firstElementChild.getBoundingClientRect().top) {
            // 命中顶部
            targetElement = editorElement.firstElementChild as HTMLElement;
            point.className = "dragover__top";
        } else if (contentRect) {
            const editorPosition = {
                left: contentRect.left + parseInt(editorElement.style.paddingLeft),
                right: contentRect.left + protyle.contentElement.clientWidth - parseInt(editorElement.style.paddingRight)
            };
            if (event.clientX < editorPosition.left) {
                // 左侧
                point.x = editorPosition.left;
                point.className = "dragover__left";
            } else if (event.clientX >= editorPosition.right) {
                // 右侧
                point.x = editorPosition.right - 6;
                point.className = "dragover__right";
            }
            targetElement = document.elementFromPoint(point.x, point.y) as HTMLElement;
            if (targetElement.classList.contains("protyle-wysiwyg")) {
                // 命中间隙
                targetElement = document.elementFromPoint(point.x, point.y - 6) as HTMLElement;
            }
            targetElement = hasTopClosestByAttribute(targetElement, "data-node-id", null);
            if (targetElement && targetElement.classList.contains("sb") && targetElement.getAttribute("data-sb-layout") === "col") {
                const childElements = targetElement.querySelectorAll("[data-node-id]");
                if (point.className === "dragover__left") {
                    targetElement = childElements[0] as HTMLElement;
                } else {
                    targetElement = childElements[childElements.length - 1] as HTMLElement;
                }
            }
        }
    } else if (targetElement && targetElement.classList.contains("list")) {
        if (gutterTypes[0] !== "nodelistitem") {
            targetElement = hasClosestBlock(document.elementFromPoint(event.clientX, event.clientY - 6));
        } else {
            targetElement = hasClosestByClassName(document.elementFromPoint(event.clientX, event.clientY - 6), "li");
        }
    }
    if (gutterType && gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}Col${Constants.ZWSP}`.toLowerCase())) {
        // 表头只能拖拽到当前 av 的表头中
        targetElement = hasClosestByClassName(event.target, "av__cell");
        if (targetElement) {
            const targetRowElement = hasClosestByClassName(targetElement, "av__row--header");
            const dragRowElement = hasClosestByClassName(window.siyuan.dragElement, "av__row--header");
            if (targetElement === window.siyuan.dragElement || !targetRowElement || !dragRowElement ||
                (targetRowElement && dragRowElement && targetRowElement !== dragRowElement)
            ) {
                targetElement = false;
            }
        }
    } else if (targetElement && gutterType && gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeViewRowMenu${Constants.ZWSP}`.toLowerCase())) {
        if ((!targetElement.classList.contains("av__row") && !targetElement.classList.contains("av__row--util")) ||
            (window.siyuan.dragElement && !window.siyuan.dragElement.contains(targetElement))) {
            // 行只能拖拽当前 av 中
            targetElement = false;
        } else {
            const bodyElement = hasClosestByClassName(targetElement, "av__body");
            if (bodyElement) {
                const blockElement = hasClosestBlock(bodyElement) as HTMLElement;
                const groupID = bodyElement.getAttribute("data-group-id");
                // 模板、创建时间、更新时间 字段作为分组方式时不允许跨分组拖拽 https://github.com/siyuan-note/siyuan/issues/15553
                const isTCU = ["template", "created", "updated"].includes(bodyElement.getAttribute("data-dtype"));
                // 排序只能夸组拖拽
                const hasSort = blockElement.querySelector('.block__icon[data-type="av-sort"]')?.classList.contains("block__icon--active");
                gutterTypes[2].split(",").find(item => {
                    const sourceGroupID = item ? item.split("@")[1] : "";
                    if (sourceGroupID !== groupID && isTCU) {
                        targetElement = false;
                        return true;
                    }
                    if (sourceGroupID === groupID && hasSort) {
                        targetElement = false;
                        return true;
                    }
                });
            }
        }
    } else if (targetElement && gutterType && gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}GalleryItem${Constants.ZWSP}`.toLowerCase())) {
        const containerElement = hasClosestByClassName(event.target, "av__container");
        if (targetElement.classList.contains("av") || !containerElement ||
            !containerElement.contains(window.siyuan.dragElement) || targetElement === window.siyuan.dragElement) {
            // gallery item 只能拖拽当前 av 中
            targetElement = false;
        } else {
            const bodyElement = hasClosestByClassName(targetElement, "av__body");
            if (bodyElement) {
                const blockElement = hasClosestBlock(bodyElement) as HTMLElement;
                const groupID = bodyElement.getAttribute("data-group-id");
                // 模板、创建时间、更新时间 字段作为分组方式时不允许跨分组拖拽 https://github.com/siyuan-note/siyuan/issues/15553
                const isTCU = ["template", "created", "updated"].includes(bodyElement.getAttribute("data-dtype"));
                // 排序只能夸组拖拽
                const hasSort = blockElement.querySelector('.block__icon[data-type="av-sort"]')?.classList.contains("block__icon--active");
                gutterTypes[2].split(",").find(item => {
                    const sourceGroupID = item ? item.split("@")[1] : "";
                    if (sourceGroupID !== groupID && isTCU) {
                        targetElement = false;
                        return true;
                    }
                    if (sourceGroupID === groupID && hasSort) {
                        targetElement = false;
                        return true;
                    }
                });
            }
        }
    }

    if (!targetElement) {
        editorElement.querySelectorAll(".dragover__bottom, .dragover__top, .dragover, .dragover__left, .dragover__right").forEach((item: HTMLElement) => {
            item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__left", "dragover__right");
        });
        return;
    }
    const isNotAvItem = !targetElement.classList.contains("av__row") &&
        !targetElement.classList.contains("av__row--util") &&
        !targetElement.classList.contains("av__gallery-item") &&
        !targetElement.classList.contains("av__gallery-add");
    if (targetElement && state.dragoverElement && targetElement === state.dragoverElement) {
        // 性能优化，目标为同一个元素不再进行校验
        const nodeRect = targetElement.getBoundingClientRect();
        editorElement.querySelectorAll(".dragover__left, .dragover__right, .dragover__bottom, .dragover__top, .dragover").forEach((item: HTMLElement) => {
            item.classList.remove("dragover__top", "dragover__bottom", "dragover__left", "dragover__right", "dragover");
            item.removeAttribute("select-start");
            item.removeAttribute("select-end");
        });
        // 文档树拖拽限制
        if (fileTreeIds.indexOf("-") > -1 && isNotAvItem) {
            if (!event.altKey) {
                return;
            } else if (fileTreeIds.split(",").includes(protyle.block.rootID) && event.altKey) {
                return;
            }
        }
        if (targetElement.getAttribute("data-type") === "NodeAttributeView" && hasClosestByTag(event.target, "TD")) {
            return;
        }
        if (point.className) {
            targetElement.classList.add(point.className);
            addDragover(targetElement);
            return;
        }
        // 忘记为什么要限定文档树的拖拽了，先放开 https://github.com/siyuan-note/siyuan/pull/13284#issuecomment-2503853135
        if (targetElement.getAttribute("data-type") === "NodeListItem") {
            if (event.clientY > nodeRect.top + nodeRect.height / 2) {
                targetElement.classList.add("dragover__bottom");
                addDragover(targetElement);
            } else if (!targetElement.classList.contains("av__row--header")) {
                targetElement.classList.add("dragover__top");
                addDragover(targetElement);
            }
            return;
        }

        if (targetElement.classList.contains("av__cell")) {
            if (event.clientX < nodeRect.left + nodeRect.width / 2 && event.clientX > nodeRect.left &&
                !targetElement.classList.contains("av__row") && targetElement.previousElementSibling !== window.siyuan.dragElement) {
                targetElement.classList.add("dragover__left");
            } else if (event.clientX > nodeRect.right - nodeRect.width / 2 && event.clientX <= nodeRect.right + 1 &&
                !targetElement.classList.contains("av__row") && targetElement !== window.siyuan.dragElement.previousElementSibling) {
                if (window.siyuan.dragElement.previousElementSibling.classList.contains("av__colsticky") &&
                    targetElement === window.siyuan.dragElement.previousElementSibling.lastElementChild) {
                    // 拖拽到固定列的最后一个元素
                } else {
                    targetElement.classList.add("dragover__right");
                }
            }
            return;
        }
        // gallery & kanban
        if (targetElement.classList.contains("av__gallery-item")) {
            if (hasClosestByClassName(targetElement, "av__kanban-group")) {
                const midTop = nodeRect.top + nodeRect.height / 2;
                if (event.clientY < midTop && event.clientY > nodeRect.top - 13) {
                    targetElement.classList.add("dragover__top");
                } else if (event.clientY > midTop && event.clientY <= nodeRect.bottom + 13) {
                    targetElement.classList.add("dragover__bottom");
                }
            } else {
                const midLeft = nodeRect.left + nodeRect.width / 2;
                if (event.clientX < midLeft && event.clientX > nodeRect.left - 13) {
                    targetElement.classList.add("dragover__left");
                } else if (event.clientX > midLeft && event.clientX <= nodeRect.right + 13) {
                    targetElement.classList.add("dragover__right");
                }
            }
            return;
        }
        if (targetElement.classList.contains("av__gallery-add")) {
            if (hasClosestByClassName(targetElement, "av__kanban-group")) {
                targetElement.classList.add("dragover__top");
            } else {
                targetElement.classList.add("dragover__left");
            }
            return;
        }

        if (event.clientX < nodeRect.left + (targetElement.classList.contains("list") ? 8 : 32) &&
            event.clientX >= nodeRect.left - 1 &&
            !targetElement.classList.contains("av__row")) {
            targetElement.classList.add("dragover__left");
            addDragover(targetElement);
        } else if (event.clientX > nodeRect.right - 32 && event.clientX < nodeRect.right &&
            !targetElement.classList.contains("av__row")) {
            targetElement.classList.add("dragover__right");
            addDragover(targetElement);
        } else if (targetElement.classList.contains("av__row--header")) {
            targetElement.classList.add("dragover__bottom");
        } else if (targetElement.classList.contains("av__row--util")) {
            targetElement.previousElementSibling.classList.add("dragover__bottom");
        } else {
            if (event.clientY > nodeRect.top + nodeRect.height / 2 && state.disabledPosition !== "bottom") {
                targetElement.classList.add("dragover__bottom");
                addDragover(targetElement);
            } else if (state.disabledPosition !== "top") {
                targetElement.classList.add("dragover__top");
                addDragover(targetElement);
            }
        }
        return;
    }

    if (fileTreeIds.indexOf("-") > -1) {
        if (fileTreeIds.split(",").includes(protyle.block.rootID) && isNotAvItem && event.altKey) {
            state.dragoverElement = undefined;
            editorElement.querySelectorAll(".dragover__left, .dragover__right, .dragover__bottom, .dragover__top, .dragover").forEach((item: HTMLElement) => {
                item.classList.remove("dragover__top", "dragover__bottom", "dragover__left", "dragover__right", "dragover");
                item.removeAttribute("select-start");
                item.removeAttribute("select-end");
            });
        } else {
            state.dragoverElement = targetElement;
        }
        return;
    }

    if (gutterType) {
        state.disabledPosition = "";
        // gutter 文档内拖拽限制
        // 排除自己及子孙
        if (gutterTypes[0] === "nodeattributeview" && gutterTypes[1] === "col" && targetElement.getAttribute("data-id") === gutterTypes[2]) {
            // 表头不能拖到自己上
            clearDragoverElement(state.dragoverElement);
            return;
        }
        if (gutterTypes[0] === "nodeattributeviewrowmenu" && gutterTypes[2].split("@")[0] === targetElement.getAttribute("data-id")) {
            // 行不能拖到自己上
            clearDragoverElement(state.dragoverElement);
            return;
        }
        const isSelf = gutterTypes[2].split(",").find((item: string) => {
            if (item && hasClosestByAttribute(targetElement as HTMLElement, "data-node-id", item)) {
                return true;
            }
        });
        if (isSelf && "nodeattributeviewrowmenu" !== gutterTypes[0]) {
            clearDragoverElement(state.dragoverElement);
            return;
        }
        if (isInEmbedBlock(targetElement)) {
            // 不允许托入嵌入块
            clearDragoverElement(state.dragoverElement);
            return;
        }
        if (gutterTypes[0] === "nodelistitem" && "NodeListItem" === targetElement.getAttribute("data-type")) {
            if (gutterTypes[1] !== targetElement.getAttribute("data-subtype")) {
                // 排除类型不同的列表项
                clearDragoverElement(state.dragoverElement);
                return;
            }
            // 选中非列表不能拖拽到列表中 https://github.com/siyuan-note/siyuan/issues/13822
            const notLiItem = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")).find((item: HTMLElement) => {
                if (!item.classList.contains("li")) {
                    return true;
                }
            });
            if (notLiItem) {
                clearDragoverElement(state.dragoverElement);
                return;
            }
        }
        if (gutterTypes[0] !== "nodelistitem" && targetElement.getAttribute("data-type") === "NodeListItem") {
            // 非列表项不能拖入列表项周围
            clearDragoverElement(state.dragoverElement);
            return;
        }
        if (gutterTypes[0] === "nodelistitem" && targetElement.parentElement.classList.contains("li") &&
            targetElement.previousElementSibling?.classList.contains("protyle-action")) {
            // 列表项不能拖入列表项中第一个元素之上
            state.disabledPosition = "top";
        }
        if (gutterTypes[0] === "nodelistitem" &&
            targetElement.nextElementSibling?.classList.contains("list") &&
            targetElement.parentElement?.classList.contains("li")) {
            // 列表项不能拖入列表上方块的下面
            state.disabledPosition = "bottom";
        }
        if (targetElement && targetElement.classList.contains("av__row--header")) {
            // 块不能拖在表头上
            state.disabledPosition = "top";
        }
        state.dragoverElement = targetElement;
    }
};
