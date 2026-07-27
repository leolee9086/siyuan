/** 用途：打开新增列菜单。使用范围：`av-header-add` 点击。解耦评估：列菜单由 col 子模块维护，当前模块只负责路由。 */
import { addCol } from "./imports";
/** 用途：提供添加列后的完整面板导航；使用范围：`av-header-add`；解耦评估：传入完整领域外观，不传单方法回调。 */
import {avMenuPanel} from "./imports";
/** 用途：新增属性视图。使用范围：`av-add` 点击。解耦评估：视图创建逻辑由 view 子模块维护，click 侧只转发。 */
import { addView } from "./imports";
/** 用途：打开 gallery 卡片编辑。使用范围：`av-gallery-edit` 点击。解耦评估：gallery 编辑流程应继续留在 gallery 子模块。 */
import { editGalleryItem } from "./imports";
/** 用途：读取单元格文本。使用范围：copy 按钮点击。解耦评估：复制文本规则由 cell 子模块定义，当前模块只消费结果。 */
import { getCellText } from "./imports";
/** 用途：按类名查找局部容器。使用范围：底部插入和 copy 分支。解耦评估：DOM 遍历规则继续复用共享工具即可。 */
import { hasClosestByClassName } from "./imports";
/** 用途：插入行或卡片。使用范围：顶部/底部新增和页尾补行。解耦评估：previousID/groupID 语义属于 row 子模块职责。 */
import { insertRows } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：body 和单元格节点校验。解耦评估：DOM guard 属于基础能力，继续统一复用更清晰。 */
import { isHTMLElement } from "./imports";
/** 用途：打开 gallery 更多菜单。使用范围：`av-gallery-more` 点击。解耦评估：gallery 菜单逻辑由 gallery 子模块维护，当前模块不应内联。 */
import { openGalleryItemMenu } from "./imports";
/** 用途：打开属性视图配置面板。使用范围：properties/config/switcher/sorts/filters 入口。解耦评估：这些面板共享 openMenuPanel 作为稳定边界。 */
import { openMenuPanel } from "./imports";
/** 用途：设置分页大小。使用范围：`set-page-size` 点击。解耦评估：分页设置涉及服务端状态和刷新，继续复用 row 子模块更稳。 */
import { setPageSize } from "./imports";
/** 用途：显示轻量提示。使用范围：copy 成功提示。解耦评估：消息提示是 UI 基础能力，继续共享即可。 */
import { showMessage } from "./imports";
/** 用途：提供国际化文案。使用范围：copy 成功提示。解耦评估：语言对象是全局只读上下文，当前直接经 imports.ts 读取即可。 */
import { siyuanI18n } from "./imports";
/** 用途：写入系统剪贴板。使用范围：copy 按钮点击。解耦评估：剪贴板兼容逻辑已在工具层封装，当前模块直接调用即可。 */
import { writeText } from "./imports";
/** 用途：统一结束已处理点击。使用范围：所有 data-type handler 的成功分支。解耦评估：这是 click 子目录内部共用动作，集中在 shared.ts 更利于复用。 */
import { consumeClickEvent } from "./shared";
/** 用途：映射 data-type 到配置面板类型。使用范围：配置类按钮点击。解耦评估：这是 click 子目录内部规则，集中在 shared.ts 更利于统一维护。 */
import { getMenuPanelType } from "./shared";
/** 用途：处理较长的高级 data-type 分支。使用范围：block-more、分组折叠、load-more 和搜索图标。解耦评估：这些分支副作用更重，拆到专门模块更利于控制复杂度。 */
/** 用途：处理较长的高级 data-type 分支。使用范围：分组折叠箭头点击。解耦评估：延时事务提交逻辑已经下沉到专门模块，当前文件只负责调度。 */
import { handleGroupFoldClick } from "./dataType.advanced";
/** 用途：处理较长的高级 data-type 分支。使用范围：load-more 点击。解耦评估：局部 DOM 修复和重渲染逻辑拆出后更便于审计。 */
import { handleLoadMoreClick } from "./dataType.advanced";
/** 用途：处理较长的高级 data-type 分支。使用范围：搜索图标点击。解耦评估：移动端键盘和焦点时序逻辑拆出后更便于维护。 */
import { handleSearchIconClick } from "./dataType.advanced";
import {addDragFill, createAttributeViewItem, focusByRange, hintRef, openNewItemTemplateMenu} from "./imports";

const createItem = (protyle: IProtyle, blockElement: HTMLElement, position: {previousID?: string; groupID?: string}) => {
    const templateID = blockElement.querySelector<HTMLElement>(".av__header")?.dataset.defaultTemplateId;
    if (templateID) {
        createAttributeViewItem({blockElement, protyle, templateID, position});
        return;
    }
    insertRows({
        blockElement,
        protyle,
        count: 1,
        previousID: position.previousID,
        groupID: position.groupID || "",
    });
};

/**
 * 作用：处理新增列按钮点击。
 * 意图：保持 `av-header-add` 打开新增列菜单的原行为。
 * 调用时机：data-type 分发命中 `av-header-add` 时调用。
 * 问题/改进：定位仍依赖按钮矩形。
 */
const handleHeaderAddClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const addMenu = addCol({protyle, blockElement, panel: avMenuPanel});
    const addRect = target.getBoundingClientRect();
    addMenu.open({ x: addRect.left, y: addRect.bottom, h: addRect.height });
    return consumeClickEvent(event);
};

/**
 * 作用：处理配置面板类按钮点击。
 * 意图：把 properties / config / switcher / sorts / filters 收敛到同一条入口。
 * 调用时机：`getMenuPanelType` 命中后调用。
 * 问题/改进：若未来某些面板需要差异化上下文，可以再拆回独立 handler。
 */
const handleMenuPanelClick = (
    protyle: IProtyle,
    blockElement: HTMLElement,
    panelType: "properties" | "config" | "switcher" | "sorts" | "filters",
    event: MouseEvent,
) => {
    openMenuPanel({ protyle, blockElement, type: panelType });
    return consumeClickEvent(event);
};

/**
 * 作用：处理页尾补行按钮点击。
 * 意图：保持 `av-add-more` 在当前分组末尾插入一行的原行为。
 * 调用时机：data-type 分发命中 `av-add-more` 时调用。
 * 问题/改进：groupID 仍来自 DOM attribute。
 */
const handleAddMoreClick = (protyle: IProtyle, blockElement: HTMLElement, event: MouseEvent) => {
    const bodyElement = blockElement.querySelector(".av__body");
    createItem(protyle, blockElement, {
        previousID: "",
        groupID: bodyElement?.getAttribute("data-group-id") || "",
    });
    return consumeClickEvent(event);
};

/**
 * 作用：处理新增视图按钮点击。
 * 意图：保持 `av-add` 的原交互。
 * 调用时机：data-type 分发命中 `av-add` 时调用。
 * 问题/改进：若后续需要埋点或权限判断，可在这里集中补充。
 */
const handleAddViewClick = (protyle: IProtyle, blockElement: Element, event: MouseEvent) => {
    addView(protyle, blockElement);
    return consumeClickEvent(event);
};

/**
 * 作用：处理分页大小设置按钮点击。
 * 意图：保持 `set-page-size` 的原交互。
 * 调用时机：data-type 分发命中 `set-page-size` 时调用。
 * 问题/改进：仍依赖 blockElement 上的 avID。
 */
const handleSetPageSizeClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const avID = blockElement.getAttribute("data-av-id");
    if (!avID) {
        return false;
    }
    setPageSize({ target, protyle, avID, nodeElement: blockElement });
    return consumeClickEvent(event);
};

/**
 * 作用：处理底部插入按钮点击。
 * 意图：保持 `av-add-bottom` 的 previousID / groupID 计算逻辑。
 * 调用时机：data-type 分发命中 `av-add-bottom` 时调用。
 * 问题/改进：仍依赖多段 DOM 回退取尾项。
 */
const handleAddBottomClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const bodyCandidate = hasClosestByClassName(target, "av__body");
    const utilRow = isHTMLElement(bodyCandidate) ? bodyCandidate.querySelector(".av__row--util") : null;
    const previousID = utilRow?.previousElementSibling?.getAttribute("data-id") || target.previousElementSibling?.getAttribute("data-id") || undefined;
    createItem(protyle, blockElement, {
        previousID: previousID ?? undefined,
        groupID: isHTMLElement(bodyCandidate) ? bodyCandidate.getAttribute("data-group-id") || "" : "",
    });
    return consumeClickEvent(event);
};

/**
 * 作用：处理顶部插入按钮点击。
 * 意图：保持 `av-add-top` 从分组标题下一个 body 读取 groupID 的原行为。
 * 调用时机：data-type 分发命中 `av-add-top` 时调用。
 * 问题/改进：仍依赖标题和 body 的相邻 DOM 结构。
 */
const handleAddTopClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const titleCandidate = hasClosestByClassName(target, "av__group-title");
    const bodyElement = isHTMLElement(titleCandidate) ? titleCandidate.nextElementSibling : null;
    createItem(protyle, blockElement, {
        previousID: "",
        groupID: bodyElement?.getAttribute("data-group-id") || "",
    });
    return consumeClickEvent(event);
};

/**
 * 作用：处理 gallery 编辑按钮点击。
 * 意图：保持 `av-gallery-edit` 的原交互。
 * 调用时机：data-type 分发命中 `av-gallery-edit` 时调用。
 * 问题/改进：如需附加上下文，可在这里统一扩展。
 */
const handleGalleryEditClick = (target: HTMLElement, event: MouseEvent) => {
    editGalleryItem(target);
    return consumeClickEvent(event);
};

/**
 * 作用：处理 gallery 更多按钮点击。
 * 意图：保持 `av-gallery-more` 在按钮下方打开菜单的原行为。
 * 调用时机：data-type 分发命中 `av-gallery-more` 时调用。
 * 问题/改进：定位仍依赖按钮矩形。
 */
const handleGalleryMoreClick = (protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    openGalleryItemMenu({ target, protyle, position: { x: rect.left, y: rect.bottom } });
    return consumeClickEvent(event);
};

/**
 * 作用：处理 copy 按钮点击。
 * 意图：复制当前单元格文本并提示“已复制”。
 * 调用时机：data-type 分发命中 `copy` 时调用。
 * 问题/改进：当前只复制文本，不覆盖更复杂富文本格式。
 */
const handleCopyClick = (target: HTMLElement, event: MouseEvent) => {
    const cellCandidate = hasClosestByClassName(target, "av__cell");
    if (!isHTMLElement(cellCandidate)) {
        return false;
    }
    writeText(getCellText(cellCandidate));
    showMessage(siyuanI18n.copied);
    return consumeClickEvent(event);
};

const handleAddTemplateClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    openNewItemTemplateMenu({protyle, blockElement, target});
    return consumeClickEvent(event);
};

const getDatabaseRowElements = (target: HTMLElement) => {
    const cellElement = hasClosestByClassName(target, "av__cell");
    const rowElement = hasClosestByClassName(target, "av__row") || hasClosestByClassName(target, "av__gallery-item");
    if (!isHTMLElement(cellElement) || !isHTMLElement(rowElement)) {
        return;
    }
    return {cellElement, rowElement};
};

const handleOpenDatabaseRow = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const elements = getDatabaseRowElements(target);
    if (!elements) {
        return false;
    }
    const textElement = elements.cellElement.querySelector<HTMLElement>(".av__celltext");
    protyle.app.openDatabaseRow(protyle, {
        avID: blockElement.dataset.avId,
        databaseBlockID: blockElement.dataset.nodeId,
        notebookID: protyle.notebookId,
        itemID: elements.rowElement.dataset.id,
        valueID: elements.cellElement.dataset.id,
        title: textElement?.textContent.trim(),
        boundBlockID: elements.cellElement.querySelector<HTMLElement>(".av__celltext--ref")?.dataset.id,
        isDetached: elements.cellElement.dataset.detached === "true" || !elements.cellElement.querySelector(".av__celltext--ref"),
    });
    return consumeClickEvent(event);
};

const handleUpdateDatabaseRow = (protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const cellElement = hasClosestByClassName(target, "av__cell");
    const textElement = cellElement?.querySelector<HTMLElement>(".av__celltext");
    if (!isHTMLElement(cellElement) || !textElement || !protyle.toolbar) {
        return false;
    }
    protyle.toolbar.range = document.createRange();
    protyle.toolbar.range.selectNodeContents(textElement);
    focusByRange(protyle.toolbar.range);
    cellElement.classList.add("av__cell--select");
    addDragFill(cellElement);
    hintRef(textElement.textContent.trim(), protyle, "av");
    return consumeClickEvent(event);
};

const DATA_TYPE_HANDLERS = new Map<string, (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    viewType: TAVView,
    event: MouseEvent,
) => boolean>([
    ["av-header-add", (protyle, target, blockElement, _viewType, event) => protyle.disabled ? false : handleHeaderAddClick(protyle, target, blockElement, event)],
    ["av-add-more", (protyle, _target, blockElement, _viewType, event) => protyle.disabled ? false : handleAddMoreClick(protyle, blockElement, event)],
    ["av-add-template", (protyle, target, blockElement, _viewType, event) => protyle.disabled ? false : handleAddTemplateClick(protyle, target, blockElement, event)],
    ["av-add", (protyle, _target, blockElement, _viewType, event) => protyle.disabled ? false : handleAddViewClick(protyle, blockElement, event)],
    ["av-row-open", (protyle, target, blockElement, _viewType, event) => handleOpenDatabaseRow(protyle, target, blockElement, event)],
    ["av-row-update", (protyle, target, _blockElement, _viewType, event) => protyle.disabled ? false : handleUpdateDatabaseRow(protyle, target, event)],
    ["set-page-size", (protyle, target, blockElement, _viewType, event) => protyle.disabled ? false : handleSetPageSizeClick(protyle, target, blockElement, event)],
    ["av-add-bottom", (protyle, target, blockElement, _viewType, event) => protyle.disabled ? false : handleAddBottomClick(protyle, target, blockElement, event)],
    ["av-add-top", (protyle, target, blockElement, _viewType, event) => protyle.disabled ? false : handleAddTopClick(protyle, target, blockElement, event)],
    ["av-gallery-edit", (protyle, target, _blockElement, _viewType, event) => protyle.disabled ? false : handleGalleryEditClick(target, event)],
    ["av-gallery-more", (protyle, target, _blockElement, _viewType, event) => protyle.disabled ? false : handleGalleryMoreClick(protyle, target, event)],
    ["av-group-fold", (protyle, target, blockElement, _viewType, event) => handleGroupFoldClick(protyle, target, blockElement, event)],
    ["av-load-more", (protyle, target, blockElement, _viewType, event) => handleLoadMoreClick(protyle, target, blockElement, event)],
    ["copy", (_protyle, target, _blockElement, _viewType, event) => handleCopyClick(target, event)],
    ["av-search-icon", (_protyle, target, blockElement, _viewType, event) => handleSearchIconClick(target, blockElement, event)],
]);

/**
 * 作用：处理 data-type 驱动的点击分支。
 * 意图：让每个按钮型点击都落到独立 handler，保持分支顺序可审计。
 * 调用时机：avClick 在当前冒泡层级上优先调用。
 * 问题/改进：如后续 data-type 继续增长，可以按菜单/插入/配置继续细拆。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleTargetDataTypeClick = (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    viewType: TAVView,
    event: MouseEvent,
) => {
    const dataType = target.getAttribute("data-type");
    const panelType = getMenuPanelType(dataType);
    if (panelType && !protyle.disabled) {
        return handleMenuPanelClick(protyle, blockElement, panelType, event);
    }
    if (!dataType) {
        return false;
    }
    const handler = DATA_TYPE_HANDLERS.get(dataType);
    if (!handler) {
        return false;
    }
    return handler(protyle, target, blockElement, viewType, event);
};
