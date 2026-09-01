import { Constants } from "../../../constants";
import { dragoverTab } from "../../render/av/view";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasClosestByTag, hasTopClosestByAttribute, isInEmbedBlock } from "../hasClosest";
import {addDragFill} from "../../render/av/cell/decoration";
import { clearSelect } from "../clearSelect";
import {
    addDragover,
    cleanupDragIndicators,
    clearDragoverElement,
    getListDepth,
    highlightByLevel,
    highlightColColumn,
    parseHexColor,
} from "./util";
import { IDndState } from "./onDrop.types";
import { hideCaretLine, hideDragTip, showDragTip } from "../dragTip";
import { getContenteditableElement, getNextBlockSibling } from "../../wysiwyg/getBlock";
import {
    handleBlockReferenceDragover,
    renderBlockReferenceDropIndicator,
} from "./onDrop.helper.blockRef";

let kanbanGroupDragoverElement: HTMLElement | undefined;
let kanbanGroupDragoverPosition: "left" | "right" | undefined;
let kanbanGroupDragHeight = "";
const clearKanbanGroupDragover = () => {
    if (kanbanGroupDragoverElement) {
        kanbanGroupDragoverElement.classList.remove("dragover__left", "dragover__right");
        kanbanGroupDragoverElement.style.removeProperty("--b3-av-kanban-drag-height");
        kanbanGroupDragoverElement = undefined;
        kanbanGroupDragoverPosition = undefined;
    }
};
export const cleanupKanbanGroupDragover = () => {
    clearKanbanGroupDragover();
    kanbanGroupDragHeight = "";
};

const applyLiTarget = (
    editorElement: HTMLElement,
    htmlTarget: HTMLElement,
    event: DragEvent,
    state: IDndState,
    canDropAsSibling = true,
) => {
    cleanupDragIndicators(editorElement);
    const nodeId = htmlTarget.getAttribute("data-node-id") || "";
    if (!state.dragCache || state.dragCache.nodeId !== nodeId) {
        const contentBlock = Array.from(htmlTarget.children).find(item =>
            item.hasAttribute("data-node-id")) as HTMLElement;
        const indent = contentBlock ? parseFloat(getComputedStyle(contentBlock).marginLeft) || 34 : 34;
        const depth = getListDepth(htmlTarget);
        const computedColor = getComputedStyle(htmlTarget).getPropertyValue("--b3-theme-primary-lighter").trim();
        const rgb = parseHexColor(computedColor) || {r: 53, g: 115, b: 217};
        let siblingGuides = "";
        for (let n = 1; n <= depth; n++) {
            if (siblingGuides) {
                siblingGuides += ", ";
            }
            const opacity = depth <= 1 ? 0.3 : 0.5 - (n - 1) / (depth - 1) * 0.4;
            siblingGuides += `${-n * indent}px 0 0 0 rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity.toFixed(2)})`;
        }
        state.dragCache = {nodeId, indent, rgb, guides: siblingGuides || "none"};
    }

    const {indent, rgb, guides} = state.dragCache;
    const liRect = htmlTarget.getBoundingClientRect();
    const isRTL = getComputedStyle(htmlTarget).direction === "rtl";
    const offsetX = isRTL ? (liRect.right - event.clientX) : (event.clientX - liRect.left);
    const contentBlockForRect = Array.from(htmlTarget.children).find(item =>
        item.hasAttribute("data-node-id") && !item.classList.contains("list")) as HTMLElement;
    const contentRect = contentBlockForRect ? contentBlockForRect.getBoundingClientRect() : liRect;
    const isBottom = event.clientY > contentRect.top + contentRect.height / 2;
    const isFirstLi = !htmlTarget.previousElementSibling || !htmlTarget.previousElementSibling.classList.contains("li");
    const position = isFirstLi && !isBottom ? "top" : "bottom";
    const hasChildList = !!Array.from(htmlTarget.children).find(item => item.classList.contains("list"));
    const isChild = position === "bottom" && !hasChildList && offsetX >= indent;
    if (!canDropAsSibling && !isChild) {
        hideDragTip();
        return;
    }
    const sourceElements = Array.from(editorElement.querySelectorAll(".protyle-wysiwyg--select")) as HTMLElement[];
    const isNoOp = sourceElements.some(source =>
        source === htmlTarget ||
        source.contains(htmlTarget) ||
        (!isChild && position === "bottom" && source === htmlTarget.nextElementSibling) ||
        (position === "top" && source === htmlTarget.previousElementSibling));
    if (isNoOp) {
        cleanupDragIndicators(editorElement);
        hideDragTip();
        return;
    }

    const className = `dragover__${position}--${isChild ? "child" : "sibling"}`;
    htmlTarget.classList.add(className);
    htmlTarget.style.setProperty("--drag-indent", `${indent}px`);
    htmlTarget.style.setProperty("--drag-line-left", isChild ? `${indent}px` : "0");
    htmlTarget.style.setProperty("--drag-guides", guides);
    htmlTarget.style.setProperty("--drag-base-bg", isChild ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)` : "transparent");
    htmlTarget.style.setProperty("--drag-line-bg", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    highlightByLevel(editorElement, htmlTarget);

    const targetText = (getContenteditableElement(htmlTarget)?.textContent?.trim() || "").slice(0, 20);
    let action: string;
    if (event.altKey || (event.shiftKey && protyle.lite)) {
        action = window.siyuan.languages.dragTipRef;
    } else if (event.shiftKey) {
        action = window.siyuan.languages.dragTipEmbed;
    } else if (event.ctrlKey || protyle.lite) {
        action = window.siyuan.languages.duplicate;
    } else if (isChild) {
        action = window.siyuan.languages.dragTipListItemChild.replace("${x}", targetText);
    } else {
        const key = position === "bottom" ? "dragTipListItemAfter" : "dragTipListItemBefore";
        action = window.siyuan.languages[key].replace("${x}", targetText);
    }
    showDragTip(window.siyuan.dragTitle || "", action, event.clientX, event.clientY);
};

export const onDragOver = (protyle: IProtyle, editorElement: HTMLElement, event: DragEvent & { target: HTMLElement }, state: IDndState) => {
    if (protyle.disabled || event.dataTransfer.types.includes(Constants.SIYUAN_DROP_EDITOR)) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "none";
        hideDragTip();
        return;
    }
    if (handleBlockReferenceDragover(protyle, editorElement, event)) {
        return;
    }
    let gutterType = "";
    for (const type of event.dataTransfer.types) {
        if (type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            gutterType = type;
        }
    }
    if (gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}`.toLowerCase())) {
        dragoverTab(event);
        event.preventDefault();
        return;
    }
    const gutterTypes = gutterType ? gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP) : [];
    const isAvSubType = gutterTypes[0] === "nodeattributeviewrowmenu" ||
        gutterTypes[0] === "nodeattributeviewrow" ||
        (gutterTypes[0] === "nodeattributeview" && ["viewtab", "col", "galleryitem", "group"].includes(gutterTypes[1] || ""));
    const isKanbanGroupDrag = gutterTypes[0] === "nodeattributeview" && gutterTypes[1] === "group";
    if (isKanbanGroupDrag) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        hideDragTip();
        const sourceElement = window.siyuan.dragElement as HTMLElement;
        const sourceKanbanElement = sourceElement?.parentElement as HTMLElement;
        if (!kanbanGroupDragHeight && sourceElement) {
            const srcRect = sourceElement.getBoundingClientRect();
            let maxH = srcRect.height;
            sourceKanbanElement?.querySelectorAll(":scope > .av__kanban-group").forEach((item: HTMLElement) => {
                maxH = Math.max(maxH, item.offsetHeight);
            });
            kanbanGroupDragHeight = `${maxH}px`;
        }
        const kanbanElement = hasClosestByClassName(event.target, "av__kanban") as HTMLElement;
        if (!sourceElement || !sourceKanbanElement?.classList.contains("av__kanban") || kanbanElement !== sourceKanbanElement) {
            clearKanbanGroupDragover();
            return;
        }
        let targetGroupElement = hasClosestByClassName(event.target, "av__kanban-group") as HTMLElement;
        if (targetGroupElement === sourceElement) {
            clearKanbanGroupDragover();
            return;
        }
        let position: "left" | "right" = "left";
        if (!targetGroupElement) {
            const srcRect = sourceElement.getBoundingClientRect();
            if (event.clientX >= srcRect.left && event.clientX <= srcRect.right) {
                clearKanbanGroupDragover();
                return;
            }
            const groupElements = Array.from(kanbanElement.querySelectorAll(":scope > .av__kanban-group")).filter(item => item !== sourceElement) as HTMLElement[];
            const fallback = groupElements.find(item => {
                const rect = item.getBoundingClientRect();
                return event.clientX < rect.left + rect.width / 2;
            }) || groupElements[groupElements.length - 1] as HTMLElement;
            targetGroupElement = fallback;
            if (!targetGroupElement) {
                clearKanbanGroupDragover();
                return;
            }
            const fallbackRect = targetGroupElement.getBoundingClientRect();
            position = event.clientX < fallbackRect.left + fallbackRect.width / 2 ? "left" : "right";
        } else {
            const targetRect = targetGroupElement.getBoundingClientRect();
            position = event.clientX < targetRect.left + targetRect.width / 2 ? "left" : "right";
        }
        if (!targetGroupElement) {
            clearKanbanGroupDragover();
            return;
        }
        const oldVisiblePreviousID = (sourceElement.previousElementSibling as HTMLElement)?.dataset.groupId || "";
        let visiblePreviousID = position === "left" ? (targetGroupElement.previousElementSibling as HTMLElement)?.dataset.groupId || "" : targetGroupElement.dataset.groupId || "";
        if (visiblePreviousID === sourceElement.dataset.groupId) {
            visiblePreviousID = oldVisiblePreviousID;
        }
        if (visiblePreviousID === oldVisiblePreviousID) {
            clearKanbanGroupDragover();
            return;
        }
        const oldPreviousID = sourceElement.dataset.previousGroupId || "";
        let previousID = position === "left" ? targetGroupElement.dataset.previousGroupId || "" : targetGroupElement.dataset.groupId || "";
        if (previousID === sourceElement.dataset.groupId) {
            previousID = oldPreviousID;
        }
        if (previousID === oldPreviousID) {
            clearKanbanGroupDragover();
            return;
        }
        if (kanbanGroupDragoverElement === targetGroupElement && kanbanGroupDragoverPosition === position) {
            return;
        }
        clearKanbanGroupDragover();
        targetGroupElement.style.setProperty("--b3-av-kanban-drag-height", kanbanGroupDragHeight);
        targetGroupElement.classList.add(`dragover__${position}`);
        kanbanGroupDragoverElement = targetGroupElement;
        kanbanGroupDragoverPosition = position;
        return;
    }
    const isAvTarget = !!(hasClosestByClassName(event.target, "av__row") ||
        hasClosestByClassName(event.target, "av__row--util") ||
        hasClosestByClassName(event.target, "av__gallery-item") ||
        hasClosestByClassName(event.target, "av__gallery-add"));
    if (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE)) {
        showDragTip(window.siyuan.dragTitle || "",
            isAvTarget ? window.siyuan.languages.addToDatabase :
                (event.altKey ? window.siyuan.languages.dragTip2Heading : window.siyuan.languages.dragTipRef),
            event.clientX, event.clientY);
    } else if (gutterType && !isAvSubType && !(event.altKey && isInEmbedBlock(event.target))) {
        let action: string;
        if (isAvTarget) {
            action = window.siyuan.languages.addToDatabase;
        } else if (event.altKey || (event.shiftKey && protyle.lite)) {
            action = window.siyuan.languages.dragTipRef;
        } else if (event.shiftKey) {
            action = window.siyuan.languages.dragTipEmbed;
        } else if (event.ctrlKey || protyle.lite) {
            action = window.siyuan.languages.duplicate;
        } else {
            action = window.siyuan.languages.move;
        }
        showDragTip(window.siyuan.dragTitle || "", action, event.clientX, event.clientY);
    } else {
        hideDragTip();
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
    const fileTreeIds = (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE) && window.siyuan.dragElement) ? window.siyuan.dragElement.innerText : "";
    if (event.altKey && fileTreeIds.indexOf("-") === -1) {
        renderBlockReferenceDropIndicator(protyle, editorElement, event);
        return;
    }
    // 非 Alt 路径：清除可能残留的 Alt 竖线指示
    hideCaretLine();
    // 编辑器内文字拖拽或资源文件拖拽或按住 alt/shift 拖拽反链图标进入编辑器时不能运行 event.preventDefault()， 否则无光标; 需放在 !window.siyuan.dragElement 之后
    event.preventDefault();
    targetElement = hasClosestByClassName(event.target, "av__gallery-item") || hasClosestByClassName(event.target, "av__gallery-add") ||
        hasClosestByClassName(event.target, "av__row") || hasClosestByClassName(event.target, "av__row--util") ||
        hasClosestBlock(event.target);
    const directTargetElement = targetElement;
    if (targetElement && ["gallery", "kanban"].includes(targetElement.getAttribute("data-av-type")) && event.target.classList.contains("av__gallery")) {
        // 拖拽到属性视图 gallery 内，但没选中 item
        return;
    }
    const point = { x: event.clientX, y: event.clientY, className: "" };

    // 超级块中有a，b两个段落块，移动到 ab 之间的间隙 targetElement 会变为超级块，需修正为 a
    if (targetElement && (targetElement.classList.contains("bq") || targetElement.classList.contains("sb") || targetElement.classList.contains("list") || targetElement.classList.contains("li"))) {
        let prevElement = hasClosestBlock(document.elementFromPoint(point.x, point.y - 6));
        while (prevElement && targetElement.contains(prevElement)) {
            if (getNextBlockSibling(prevElement)) {
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
            let probeOffset = 6;
            while (targetElement.classList.contains("protyle-wysiwyg") && probeOffset < 100) {
                targetElement = document.elementFromPoint(point.x, point.y - probeOffset) as HTMLElement;
                probeOffset += 6;
            }
            let hProbed = false;
            if (targetElement.classList.contains("protyle-wysiwyg")) {
                const editorRect = editorElement.getBoundingClientRect();
                const editorCenter = editorRect.left + editorRect.width / 2;
                let hProbe = 6;
                while (targetElement.classList.contains("protyle-wysiwyg") && hProbe < 100) {
                    const probeX = point.x > editorCenter ? point.x - hProbe : point.x + hProbe;
                    targetElement = document.elementFromPoint(probeX, point.y) as HTMLElement;
                    hProbe += 6;
                }
                hProbed = !targetElement.classList.contains("protyle-wysiwyg");
            }
            if (gutterTypes[0] === "nodelistitem") {
                let closestLiFromPoint: HTMLElement | null;
                if (targetElement.classList.contains("li")) {
                    closestLiFromPoint = targetElement;
                } else if (targetElement.classList.contains("list")) {
                    const lis = targetElement.querySelectorAll(":scope > .li");
                    closestLiFromPoint = lis.length > 0
                        ? lis[lis.length - 1] as HTMLElement
                        : targetElement.closest(".li") as HTMLElement;
                } else {
                    closestLiFromPoint = targetElement.closest(".li") as HTMLElement;
                }
                targetElement = closestLiFromPoint || hasTopClosestByAttribute(targetElement, "data-node-id", null) as HTMLElement;
            } else {
                targetElement = hasTopClosestByAttribute(targetElement, "data-node-id", null) as HTMLElement;
            }
            if (targetElement && targetElement.classList.contains("sb") && targetElement.getAttribute("data-sb-layout") === "col") {
                if (point.className !== "dragover__left" && point.className !== "dragover__right" && !hProbed) {
                    const childElements = targetElement.querySelectorAll("[data-node-id]");
                    targetElement = childElements[point.className === "dragover__left" ? 0 : childElements.length - 1] as HTMLElement;
                }
            }
        }
    } else if (targetElement && targetElement.classList.contains("list")) {
        targetElement = hasClosestBlock(document.elementFromPoint(event.clientX, event.clientY - 6));
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
        cleanupDragIndicators(editorElement);
        hideDragTip();
        return;
    }
    // 不允许拖拽到嵌入块中（嵌入块本身或其内部任意内容均不可作为拖拽目标）
    // 例外：嵌入块是文档首块/末块且光标在其顶/底边外时，允许作为"嵌入块上/下方"落点
    if (targetElement.getAttribute("data-type") === "NodeBlockQueryEmbed") {
        if (editorElement.firstElementChild === targetElement &&
            event.clientY < targetElement.getBoundingClientRect().top) {
            point.className = "dragover__top";
        } else if (editorElement.lastElementChild === targetElement &&
            event.clientY > targetElement.getBoundingClientRect().bottom) {
            point.className = "dragover__bottom";
        } else {
            clearDragoverElement(state.dragoverElement);
            return;
        }
    } else if (isInEmbedBlock(targetElement)) {
        clearDragoverElement(state.dragoverElement);
        return;
    }
    const isNotAvItem = !targetElement.classList.contains("av__row") &&
        !targetElement.classList.contains("av__row--util") &&
        !targetElement.classList.contains("av__gallery-item") &&
        !targetElement.classList.contains("av__gallery-add");
    if (!targetElement.classList.contains("sb")) {
        const ancestorSb = targetElement.closest('[data-type="NodeSuperBlock"]') as HTMLElement;
        if (ancestorSb) {
            const sbChildBlocks = Array.from(ancestorSb.querySelectorAll("[data-node-id]"));
            const firstBlock = sbChildBlocks[0] as HTMLElement;
            const lastBlock = sbChildBlocks[sbChildBlocks.length - 1] as HTMLElement;
            const isFirstBlock = targetElement === firstBlock || firstBlock.contains(targetElement);
            const isLastBlock = targetElement === lastBlock || lastBlock.contains(targetElement);
            const childRect = targetElement.getBoundingClientRect();
                if ((isFirstBlock && event.clientX < childRect.left + 8) ||
                    (isLastBlock && event.clientX > childRect.right - 8)) {
                    targetElement = ancestorSb;
                }
                if (gutterTypes[0] === "nodelist" &&
                    ancestorSb.getAttribute("data-sb-layout") === "col" && targetElement !== ancestorSb) {
                    const columnList = targetElement.closest(".list");
                    if (columnList instanceof HTMLElement && columnList.parentElement === ancestorSb) {
                        targetElement = columnList;
                    }
                }
            }
        }
    const isListSource = gutterTypes[0] === "nodelistitem" || gutterTypes[0] === "nodelist";
    const isContentBlockSource = Boolean(gutterType) && !isListSource && !isAvSubType;
    const keepLiContentTarget = targetElement === directTargetElement && isContentBlockSource &&
        targetElement.parentElement?.getAttribute("data-type") === "NodeListItem";
    let liTarget = targetElement.classList.contains("list") || keepLiContentTarget ? null :
        (targetElement.getAttribute("data-type") === "NodeListItem"
            ? targetElement : targetElement.parentElement?.getAttribute("data-type") === "NodeListItem"
                ? targetElement.parentElement : null);
    if (isListSource && !liTarget) {
        const sourceSelected = editorElement.querySelector(".protyle-wysiwyg--select") as HTMLElement;
        if (sourceSelected && (sourceSelected.classList.contains("li") || sourceSelected.classList.contains("list"))) {
            if (targetElement.classList.contains("list") && targetElement.contains(sourceSelected)) {
                cleanupDragIndicators(editorElement);
                hideDragTip();
                return;
            }
            let current: Element | null = sourceSelected;
            while (current && current !== editorElement) {
                if (current.classList.contains("list") || current.classList.contains("li")) {
                    let previousSibling = current.previousElementSibling;
                    while (previousSibling?.classList.contains("protyle-attr")) {
                        previousSibling = previousSibling.previousElementSibling;
                    }
                    let nextSibling = current.nextElementSibling;
                    while (nextSibling?.classList.contains("protyle-attr")) {
                        nextSibling = nextSibling.nextElementSibling;
                    }
                    if (targetElement === previousSibling || targetElement === nextSibling) {
                        cleanupDragIndicators(editorElement);
                        hideDragTip();
                        return;
                    }
                }
                current = current.parentElement;
            }
        }
    }
    if (liTarget && fileTreeIds.indexOf("-") > -1 && isNotAvItem) {
        if (!event.altKey) {
            return;
        } else if (fileTreeIds.split(",").includes(protyle.block.rootID) && event.altKey) {
            return;
        }
    }
    if (isListSource && targetElement.classList.contains("list")) {
        const sourceSelected = editorElement.querySelector(".protyle-wysiwyg--select");
        if (sourceSelected && targetElement.contains(sourceSelected)) {
            cleanupDragIndicators(editorElement);
            hideDragTip();
            return;
        }
        const lis = targetElement.querySelectorAll(":scope > .li");
        const lastLi = lis[lis.length - 1];
        const firstLi = lis[0];
        const listRect = targetElement.getBoundingClientRect();
        const isListBottom = event.clientY > listRect.top + listRect.height / 2;
        const sourceIds = Array.from(editorElement.querySelectorAll(".protyle-wysiwyg--select"))
            .map((item: HTMLElement) => item.getAttribute("data-node-id"));
        const isNoOpList = (isListBottom && lastLi && sourceIds.includes(lastLi.getAttribute("data-node-id"))) ||
            (!isListBottom && firstLi && sourceIds.includes(firstLi.getAttribute("data-node-id")));
        if (isNoOpList) {
            cleanupDragIndicators(editorElement);
            hideDragTip();
            return;
        }
    }
    if (liTarget) {
        let topList: Element = liTarget;
        while (topList.parentElement?.classList.contains("li") ||
            topList.parentElement?.classList.contains("list")) {
            topList = topList.parentElement;
            if (topList.classList.contains("list") && !topList.parentElement?.classList.contains("li")) {
                break;
            }
        }
        const topListRect = topList.getBoundingClientRect();
        const isLeftEdge = event.clientX < topListRect.left + 32;
        const isRightEdge = event.clientX > topListRect.right - 32;
        if (gutterTypes[0] === "nodelistitem") {
            if (isRightEdge) {
                cleanupDragIndicators(editorElement);
                return;
            }
            applyLiTarget(editorElement, liTarget, event, state);
            return;
        }
        if (isLeftEdge || isRightEdge) {
            liTarget = null;
        } else {
            applyLiTarget(editorElement, liTarget, event, state, !isContentBlockSource);
            return;
        }
    }
    if (targetElement && state.dragoverElement && targetElement === state.dragoverElement) {
        // 性能优化，目标为同一个元素不再进行校验
        const nodeRect = targetElement.getBoundingClientRect();
        cleanupDragIndicators(editorElement);
        editorElement.querySelectorAll("[select-start], [select-end]").forEach((item: HTMLElement) => {
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
        // 拖到自身/子孙且为纯移动（无修饰键）时为无效移动
        const isSelfFast = !event.ctrlKey && !event.shiftKey && !event.altKey && gutterTypes[2]?.split(",").some((item: string) =>
            item && hasClosestByAttribute(targetElement as HTMLElement, "data-node-id", item));
        if (isSelfFast && "nodeattributeviewrowmenu" !== gutterTypes[0]) {
            hideDragTip();
            return;
        }
        if (point.className && !liTarget && !targetElement.classList.contains("sb")) {
            if (!(gutterTypes[0] === "nodelistitem" && targetElement.classList.contains("list") &&
                (point.className === "dragover__left" || point.className === "dragover__right"))) {
                targetElement.classList.add(point.className);
                addDragover(targetElement);
                let displayText = state.cachedTargetText || "";
                if (!displayText && targetElement.classList.contains("list")) {
                    const firstLi = targetElement.querySelector(":scope > .li");
                    displayText = getContenteditableElement(firstLi as HTMLElement)?.textContent?.trim() || "";
                }
                if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget && displayText) {
                    const isFront = point.className === "dragover__top" || point.className === "dragover__left";
                    const isBack = point.className === "dragover__bottom" || point.className === "dragover__right";
                    if (isFront || isBack) {
                        const isHorizontal = point.className === "dragover__left" || point.className === "dragover__right";
                        const key = (isHorizontal || state.cachedIsCol)
                            ? (isFront ? window.siyuan.languages.dragTipMoveTargetFront : window.siyuan.languages.dragTipMoveTargetBack)
                            : (isFront ? window.siyuan.languages.dragTipMoveTargetAbove : window.siyuan.languages.dragTipMoveTargetBelow);
                        showDragTip(window.siyuan.dragTitle || "", key.replace("${x}", displayText),
                            event.clientX, event.clientY);
                    }
                }
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

        if (targetElement.classList.contains("sb")) {
            const sbRect = targetElement.getBoundingClientRect();
            const isSbLeftEdge = point.className === "dragover__left" || event.clientX < sbRect.left + 32;
            const isSbRightEdge = point.className === "dragover__right" || event.clientX > sbRect.right - 32;
            if (isSbLeftEdge || isSbRightEdge) {
                const edgeClass = isSbLeftEdge ? "dragover__left" : "dragover__right";
                targetElement.classList.add(edgeClass);
                addDragover(targetElement);
                const sbFirstBlock = targetElement.querySelector("[data-node-id]") as HTMLElement;
                const sbText = getContenteditableElement(sbFirstBlock)?.textContent?.trim() || "";
                if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget && sbText) {
                    const key = isSbLeftEdge
                        ? window.siyuan.languages.dragTipMoveTargetFront
                        : window.siyuan.languages.dragTipMoveTargetBack;
                    showDragTip(window.siyuan.dragTitle || "", key.replace("${x}", sbText),
                        event.clientX, event.clientY);
                }
                return;
            }
        }

        if (event.clientX < nodeRect.left + (targetElement.classList.contains("list") ? 8 : 32) &&
            event.clientX >= nodeRect.left - 1 &&
            !targetElement.classList.contains("av__row")) {
            targetElement.classList.add("dragover__left");
            addDragover(targetElement);
            if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget &&
                !targetElement.classList.contains("sb") && state.cachedTargetText) {
                showDragTip(window.siyuan.dragTitle || "",
                    window.siyuan.languages.dragTipMoveTargetFront.replace("${x}", state.cachedTargetText),
                    event.clientX, event.clientY);
            }
        } else if (event.clientX > nodeRect.right - 32 && event.clientX < nodeRect.right &&
            !targetElement.classList.contains("av__row")) {
            targetElement.classList.add("dragover__right");
            addDragover(targetElement);
            if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget &&
                !targetElement.classList.contains("sb") && state.cachedTargetText) {
                showDragTip(window.siyuan.dragTitle || "",
                    window.siyuan.languages.dragTipMoveTargetBack.replace("${x}", state.cachedTargetText),
                    event.clientX, event.clientY);
            }
        } else if (targetElement.classList.contains("av__row--header")) {
            targetElement.classList.add("dragover__bottom");
        } else if (targetElement.classList.contains("av__row--util")) {
            targetElement.previousElementSibling.classList.add("dragover__bottom");
        } else {
            if (event.clientY > nodeRect.top + nodeRect.height / 2 && state.disabledPosition !== "bottom") {
                targetElement.classList.add("dragover__bottom");
                addDragover(targetElement);
                if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget &&
                    !targetElement.classList.contains("sb") && state.cachedTargetText) {
                    showDragTip(window.siyuan.dragTitle || "",
                        (state.cachedIsCol ? window.siyuan.languages.dragTipMoveTargetBack : window.siyuan.languages.dragTipMoveTargetBelow).replace("${x}", state.cachedTargetText),
                        event.clientX, event.clientY);
                }
            } else if (state.disabledPosition !== "top") {
                targetElement.classList.add("dragover__top");
                addDragover(targetElement);
                if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && !isAvTarget &&
                    !targetElement.classList.contains("sb") && state.cachedTargetText) {
                    showDragTip(window.siyuan.dragTitle || "",
                        (state.cachedIsCol ? window.siyuan.languages.dragTipMoveTargetFront : window.siyuan.languages.dragTipMoveTargetAbove).replace("${x}", state.cachedTargetText),
                        event.clientX, event.clientY);
                }
            }
        }
        return;
    }

    if (fileTreeIds.indexOf("-") > -1) {
        if (fileTreeIds.split(",").includes(protyle.block.rootID) && isNotAvItem && event.altKey) {
            state.dragoverElement = undefined;
            cleanupDragIndicators(editorElement);
            editorElement.querySelectorAll("[select-start], [select-end]").forEach((item: HTMLElement) => {
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
        if (isSelf && "nodeattributeviewrowmenu" !== gutterTypes[0] && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            // 拖到自身/子孙且为纯移动时无操作；Ctrl(复制)/Shift(嵌入)/Alt(引用) 允许落在源自身位置
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
        state.cachedTargetText = getContenteditableElement(targetElement as HTMLElement)?.textContent?.trim() || "";
        state.cachedIsCol = !!hasClosestByAttribute(targetElement as HTMLElement, "data-sb-layout", "col");
        highlightColColumn(targetElement as HTMLElement);
    }
    if (!event.altKey && !event.shiftKey && !event.ctrlKey && gutterType && !isAvSubType && targetElement && !isAvTarget && point.className) {
        const targetText = getContenteditableElement(targetElement as HTMLElement)?.textContent?.trim() || "";
        const isFront = point.className === "dragover__top" || point.className === "dragover__left";
        const isBack = point.className === "dragover__bottom" || point.className === "dragover__right";
        if (targetText && (isFront || isBack)) {
            const isCol = hasClosestByAttribute(targetElement as HTMLElement, "data-sb-layout", "col");
            const key = isCol
                ? (isFront ? window.siyuan.languages.dragTipMoveTargetFront : window.siyuan.languages.dragTipMoveTargetBack)
                : (isFront ? window.siyuan.languages.dragTipMoveTargetAbove : window.siyuan.languages.dragTipMoveTargetBelow);
            showDragTip(window.siyuan.dragTitle || "", key.replace("${x}", targetText),
                event.clientX, event.clientY);
        }
    }
};
