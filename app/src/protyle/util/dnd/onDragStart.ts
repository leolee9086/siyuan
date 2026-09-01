/** 用途：提供拖拽协议常量；使用范围：当前入口的 MIME 数据；解耦评估：经 dnd imports.ts 集中复用，避免协议字符串分叉。 */
import {Constants} from "./imports";
/** 用途：解析块与属性视图祖先；使用范围：拖拽目标识别；解耦评估：DOM 祖先算法由 DnD 依赖入口统一维护。 */
import {hasClosestBlock} from "./imports";
/** 用途：解析带类名的拖拽祖先；使用范围：嵌入块、分组与画廊；解耦评估：复用既有 DOM 查询契约，避免局部实现差异。 */
import {hasClosestByClassName} from "./imports";
/** 用途：取得块可编辑文本；使用范围：拖拽标题登记；解耦评估：复用 wysiwyg 结构查询以保持编辑器兼容。 */
import {getContenteditableElement} from "./imports";
/** 用途：定位拖拽 ghost；使用范围：块、分组和画廊分支；解耦评估：统一触摸与原生拖拽提示生命周期。 */
import {setDragTipGhost} from "./imports";

/** 将拖拽 ghost 注册到原生拖拽与触摸拖拽两条生命周期。 */
const registerDragGhost = (options: {
    ghostElement: HTMLElement;
    dataTransfer: DataTransfer;
    offsetX: number;
    offsetY: number;
}) => {
    const {ghostElement, dataTransfer, offsetX, offsetY} = options;
    document.body.append(ghostElement);
    setDragTipGhost(ghostElement, offsetX, offsetY);
    dataTransfer.setDragImage(ghostElement, offsetX, offsetY);
    // 触摸拖拽需要保留 ghost，直到 pointer/blur 取消流程主动清理。
    if (window.siyuan.touchDragActive) {
        window.siyuan.touchDragGhost = ghostElement;
        return;
    }
    // 普通拖拽在当前渲染帧后移除临时 ghost，避免影响后续布局。
    window.requestAnimationFrame(() => ghostElement.remove());
};

/** 从原生事件目标解析可参与拖拽的 HTML 元素。 */
const getDragTarget = (eventTarget: EventTarget | null) => {
    if (!(eventTarget instanceof HTMLElement)) {
        return;
    }
    if (!eventTarget.classList.contains("av__gallery-img")) {
        return eventTarget;
    }
    const galleryItem = hasClosestByClassName(eventTarget, "av__gallery-item");
    return galleryItem instanceof HTMLElement ? galleryItem : eventTarget;
};

/** 处理属性视图中的视图标签拖拽。 */
const handleViewTabDrag = (target: HTMLElement, dataTransfer: DataTransfer) => {
    if (!target.parentElement?.parentElement?.classList.contains("av__views")) {
        return false;
    }
    window.siyuan.dragElement = target;
    target.style.width = `${target.clientWidth}px`;
    target.style.opacity = ".36";
    const viewID = target.previousElementSibling?.getAttribute("data-id");
    dataTransfer.setData(
        `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}${[viewID]}`,
        target.outerHTML,
    );
    return true;
};

/** 处理编辑器块操作柄拖拽并准备块 ghost。 */
const handleActionDrag = (protyle: IProtyle, parentElement: HTMLElement, dataTransfer: DataTransfer) => {
    parentElement.classList.add("protyle-wysiwyg--select");
    const ghostElement = document.createElement("div");
    ghostElement.className = protyle.wysiwyg.element.className;
    const cloneNode = parentElement.cloneNode(true);
    if (!(cloneNode instanceof Element)) {
        return;
    }
    for (const item of cloneNode.querySelectorAll(".iframe")) {
        item.remove();
    }
    ghostElement.append(cloneNode);
    ghostElement.setAttribute(
        "style",
        `position:fixed;opacity:.1;width:${parentElement.clientWidth}px;padding:0;`,
    );
    registerDragGhost({ghostElement, dataTransfer, offsetX: 0, offsetY: 0});
    window.siyuan.dragTitle = getContenteditableElement(parentElement)?.textContent?.trim() || "";
    window.siyuan.dragElement = protyle.wysiwyg.element;
    dataTransfer.setData(
        `${Constants.SIYUAN_DROP_GUTTER}NodeListItem${Constants.ZWSP}${parentElement.getAttribute("data-subtype")}${Constants.ZWSP}${[parentElement.getAttribute("data-node-id")]}`,
        protyle.wysiwyg.element.innerHTML,
    );
};

/** 处理属性视图列标题拖拽。 */
const handleColumnDrag = (target: HTMLElement, dataTransfer: DataTransfer) => {
    if (!target.classList.contains("av__cell--header")) {
        return false;
    }
    window.siyuan.dragElement = target;
    dataTransfer.setData(
        `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}Col${Constants.ZWSP}${[target.getAttribute("data-col-id")]}`,
        target.outerHTML,
    );
    return true;
};

/** 处理看板分组标题拖拽并登记分组 ghost。 */
const handleGroupDrag = (target: HTMLElement, dataTransfer: DataTransfer) => {
    const titleElement = hasClosestByClassName(target, "av__group-title");
    if (!(titleElement instanceof HTMLElement) || titleElement.getAttribute("draggable") !== "true") {
        return false;
    }
    const groupElement = titleElement.parentElement;
    if (!groupElement) {
        return false;
    }
    const groupRect = groupElement.getBoundingClientRect();
    const ghostElement = document.createElement("div");
    ghostElement.className = groupElement.className;
    ghostElement.innerHTML = titleElement.outerHTML;
    ghostElement.setAttribute(
        "style",
        `left:1px;top:100vh;position:fixed;opacity:.1;padding:8px;z-index:8;width:${groupRect.width}px;`,
    );
    registerDragGhost({ghostElement, dataTransfer, offsetX: -10, offsetY: -10});
    groupElement.style.opacity = ".38";
    window.siyuan.dragElement = groupElement;
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData(
        `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}Group${Constants.ZWSP}${groupElement.dataset.groupId || ""}`,
        groupElement.outerHTML,
    );
    return true;
};

/** 判断属性视图当前排序模式是否禁止拖拽画廊项目。 */
const isGalleryDragLocked = (blockElement: Element) => {
    const sortIcon = blockElement.querySelector('.block__icon[data-type="av-sort"]');
    if (!sortIcon?.classList.contains("block__icon--active")) {
        return false;
    }
    const bodyElements = blockElement.querySelectorAll(".av__body");
    const firstBody = bodyElements[0];
    return bodyElements.length === 1 || !firstBody || ["template", "created", "updated"].includes(firstBody.getAttribute("data-dtype") || "");
};

/** 清除当前画廊项目选择并选中新的拖拽起点。 */
const selectGalleryItem = (blockElement: Element, target: HTMLElement) => {
    if (target.classList.contains("av__gallery-item--select")) {
        return;
    }
    for (const item of blockElement.querySelectorAll(".av__gallery-item--select")) {
        item.classList.remove("av__gallery-item--select");
    }
    target.classList.add("av__gallery-item--select");
};

/** 将一个选中画廊项目复制到对应的 ghost 分组。 */
const appendGalleryClone = (options: {
    item: HTMLElement;
    isKanban: boolean;
    cloneGalleryElement: HTMLElement | undefined;
}) => {
    const {item, isKanban, cloneGalleryElement} = options;
    if (!cloneGalleryElement) {
        return;
    }
    const cloneNode = item.cloneNode(true);
    if (!(cloneNode instanceof Element)) {
        return;
    }
    cloneNode.setAttribute("style", `height:${item.clientHeight}px;`);
    cloneNode.classList.remove("av__gallery-item--select");
    if (isKanban) {
        cloneGalleryElement.firstElementChild?.appendChild(cloneNode);
        return;
    }
    cloneGalleryElement.appendChild(cloneNode);
};

/** 构造属性视图画廊的拖拽 ghost，并返回全部选中项目。 */
const buildGalleryGhost = (blockElement: Element, selectedItems: HTMLElement[]) => {
    const ghostElement = document.createElement("div");
    ghostElement.className = "protyle-wysiwyg protyle-wysiwyg--attr";
    const isKanban = blockElement.getAttribute("data-av-type") === "kanban";
    const kanbanElement = blockElement.querySelector<HTMLElement>(".av__kanban");
    if (isKanban && !kanbanElement) {
        return;
    }
    // 看板需要先建立分组容器，画廊布局则直接挂载到 ghost 根节点。
    if (isKanban && kanbanElement) {
        ghostElement.innerHTML = `<div class="${kanbanElement.className}"></div>`;
    }
    let galleryElement: HTMLElement | undefined;
    let cloneGalleryElement: HTMLElement | undefined;
    const firstSelectedItem = selectedItems[0];
    const firstSelectedWidth = firstSelectedItem?.clientWidth || 0;
    for (const item of selectedItems) {
        const itemParent = item.parentElement;
        if (!itemParent) {
            continue;
        }
        // 同一分组的后续项目复用已创建的画廊容器，保持多选拖拽结构。
        if (galleryElement?.contains(item) && cloneGalleryElement) {
            appendGalleryClone({item, isKanban, cloneGalleryElement});
            continue;
        }
        galleryElement = itemParent;
        const nextGalleryElement = document.createElement("div");
        cloneGalleryElement = nextGalleryElement;
        if (isKanban) {
            nextGalleryElement.className = "av__kanban-group";
            nextGalleryElement.setAttribute("style", itemParent.parentElement?.parentElement?.getAttribute("style") || "");
            nextGalleryElement.innerHTML = '<div class="av__gallery"></div>';
            ghostElement.firstElementChild?.appendChild(nextGalleryElement);
        }
        if (!isKanban) {
            nextGalleryElement.className = "av__gallery";
            nextGalleryElement.setAttribute(
                "style",
                `width: 100vw;margin-bottom: 16px;grid-template-columns: repeat(auto-fill, ${firstSelectedWidth}px);`,
            );
            ghostElement.appendChild(nextGalleryElement);
        }
        appendGalleryClone({item, isKanban, cloneGalleryElement: nextGalleryElement});
    }
    return ghostElement;
};

/** 处理属性视图画廊项目拖拽及其资源 ID 序列化。 */
const handleGalleryDrag = (target: HTMLElement, event: DragEvent, dataTransfer: DataTransfer) => {
    const blockElement = hasClosestBlock(target);
    if (!blockElement) {
        return;
    }
    // 模板或日期排序由属性视图自身控制时，禁止改变项目顺序。
    if (isGalleryDragLocked(blockElement)) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    selectGalleryItem(blockElement, target);
    const selectedItems: HTMLElement[] = [];
    for (const item of blockElement.querySelectorAll(".av__gallery-item--select")) {
        // 仅 HTMLElement 才能参与尺寸读取和 ghost 克隆。
        if (item instanceof HTMLElement) {
            selectedItems.push(item);
        }
    }
    const ghostElement = buildGalleryGhost(blockElement, selectedItems);
    if (!ghostElement) {
        return;
    }
    ghostElement.setAttribute("style", "left: 1px;top:100vh;position:fixed;opacity:.1;padding:0;z-index: 8");
    registerDragGhost({ghostElement, dataTransfer, offsetX: -10, offsetY: -10});
    window.siyuan.dragElement = target;
    const selectIds: string[] = [];
    for (const item of blockElement.querySelectorAll<HTMLElement>(".av__gallery-item--select")) {
        const bodyElement = hasClosestByClassName(item, "av__body");
        const itemID = item.getAttribute("data-id");
        if (!(bodyElement instanceof HTMLElement) || !itemID) {
            continue;
        }
        const groupId = bodyElement.getAttribute("data-group-id");
        selectIds.push(itemID + (groupId ? `@${groupId}` : ""));
    }
    dataTransfer.setData(
        `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}GalleryItem${Constants.ZWSP}${selectIds}`,
        ghostElement.outerHTML,
    );
};

/** 完成编辑器文本拖拽的默认数据登记。 */
const finishEditorDrag = (protyle: IProtyle, dataTransfer: DataTransfer) => {
    dataTransfer.setData(Constants.SIYUAN_DROP_EDITOR, Constants.SIYUAN_DROP_EDITOR);
    protyle.element.style.userSelect = "auto";
    document.onmousemove = null;
    document.onmouseup = null;
};

/** 启动编辑器、属性视图或移动触摸桥接产生的拖拽流程。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const onDragStart = (protyle: IProtyle, event: DragEvent) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
        return;
    }
    if (protyle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    const target = getDragTarget(event.target);
    if (!target) {
        return;
    }
    // 图片本身交给浏览器默认行为，避免与块拖拽协议竞争。
    if (target.tagName === "IMG") {
        window.siyuan.dragElement = undefined;
        event.preventDefault();
        return;
    }
    // 嵌入块不可作为独立拖拽源，清除旧的全局拖拽引用。
    if (hasClosestByClassName(target, "protyle-wysiwyg__embed")) {
        window.siyuan.dragElement = undefined;
        event.preventDefault();
        return;
    }
    if (handleViewTabDrag(target, dataTransfer)) {
        return;
    }
    const parentElement = target.parentElement;
    // 块操作柄拖拽使用编辑器块内容作为 ghost 与传输载荷。
    if (target.classList.contains("protyle-action") && parentElement) {
        handleActionDrag(protyle, parentElement, dataTransfer);
        return;
    }
    // 属性视图列标题先于分组和画廊分支处理，保持原生拖拽协议优先级。
    if (handleColumnDrag(target, dataTransfer)) {
        return;
    }
    if (handleGroupDrag(target, dataTransfer)) {
        return;
    }
    // 画廊分支负责多选项目、ghost 分组及 item ID 序列化。
    if (target.classList.contains("av__gallery-item")) {
        handleGalleryDrag(target, event, dataTransfer);
        return;
    }
    finishEditorDrag(protyle, dataTransfer);
};
