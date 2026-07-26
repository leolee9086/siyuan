import {transaction} from "../../wysiwyg/transaction/submit";
import { setPosition } from "../../../util/DOM/positioning/setPosition";
import { openEmojiPanel, unicode2Emoji } from "../../../emoji";
import { setPageSize } from "./row";
import { addView, bindViewEvent, getViewHTML } from "./view";
import {getFieldsByData} from "./view/metadata";
import { bindLayoutEvent, getLayoutHTML, updateLayout } from "./layout";
import { setGalleryCover, setGalleryRatio, setGallerySize } from "./gallery/util";
import { removeSiyuanMenu } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { asAVGallery, asHTMLElement } from "./openMenuPanel.click.guard";
import type { IMenuPanelContext } from "./openMenuPanel.types";
import type {ViewClickOutcome} from "./view/navigation.types";
import {createOpenViewMenuOutcome} from "./view/navigation";

/** 导航到配置面板：重新渲染视图配置HTML并绑定事件 @同步豁免: UI构建 */
const handleGoConfig = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    ctx.menuElement.classList.remove("av__filter-panel");
    ctx.menuElement.innerHTML = getViewHTML(ctx.data);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    bindViewEvent({ protyle: ctx.options.protyle, data: ctx.data, menuElement: ctx.menuElement, blockElement: ctx.options.blockElement });
    removeSiyuanMenu();
    event.preventDefault();
    event.stopPropagation();
};

/** 导航到属性面板：重新计算tabRect后渲染属性列表 @同步豁免: UI构建 */
const handleGoProperties = (
    ctx: IMenuPanelContext, event: MouseEvent,
    getPropertiesHTML: (fields: IAVColumn[]) => string
): void => {
    // 复制列后点击返回到属性面板，宽度不一致，需重新计算
    const viewsEl = ctx.options.blockElement.querySelector(".av__views");
    if (viewsEl) {
        ctx.tabRect = viewsEl.getBoundingClientRect();
    }
    ctx.menuElement.classList.remove("av__filter-panel");
    ctx.menuElement.innerHTML = getPropertiesHTML(ctx.fields);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    removeSiyuanMenu();
    event.preventDefault();
    event.stopPropagation();
};

/** 导航到布局面板 @同步豁免: UI构建 */
const handleGoLayout = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    ctx.menuElement.classList.remove("av__filter-panel");
    ctx.menuElement.innerHTML = getLayoutHTML(ctx.data);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    bindLayoutEvent({ protyle: ctx.options.protyle, data: ctx.data, menuElement: ctx.menuElement, blockElement: ctx.options.blockElement });
    removeSiyuanMenu();
    event.preventDefault();
    event.stopPropagation();
};

/** 更新视图图标：打开emoji选择面板 @同步豁免: UI构建 */
const handleUpdateViewIcon = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const rect = target.getBoundingClientRect();
    // @内联回调
    openEmojiPanel("", "av", {
        x: rect.left, y: rect.bottom + 4, h: rect.height, w: rect.width
    }, (unicode) => {
        transaction(ctx.options.protyle, [{
            action: "setAttrViewViewIcon", avID: ctx.avID, id: ctx.data.viewID, data: unicode,
        }], [{
            action: "setAttrViewViewIcon", id: ctx.data.viewID, avID: ctx.avID, data: target.dataset.icon,
        }]);
        target.innerHTML = unicode ? unicode2Emoji(unicode) : '<svg style="width: 14px;height: 14px;"><use xlink:href="#iconTable"></use></svg>';
        target.dataset.icon = unicode;
    }, target.querySelector("img") ?? undefined);
    event.preventDefault();
    event.stopPropagation();
};

/** 复制视图 @同步豁免: UI构建 */
const handleDuplicateView = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    const id = Lute.NewNodeID();
    transaction(ctx.options.protyle, [{
        action: "duplicateAttrViewView", avID: ctx.avID, previousID: ctx.data.viewID, id, blockID: ctx.blockID
    }], [{
        action: "removeAttrViewView", avID: ctx.avID, id, blockID: ctx.blockID
    }]);
    ctx.avPanelElement.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 删除视图 @同步豁免: UI构建 */
const handleDeleteView = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    transaction(ctx.options.protyle, [{
        action: "removeAttrViewView", avID: ctx.avID, id: ctx.data.viewID, blockID: ctx.blockID
    }]);
    ctx.avPanelElement.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 新增视图 @同步豁免: UI构建 */
const handleAvAdd = (ctx: IMenuPanelContext, event: MouseEvent): void => {
    removeSiyuanMenu();
    addView(ctx.options.protyle, ctx.options.blockElement);
    ctx.avPanelElement.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 获取当前聚焦视图的ID @同步豁免: UI构建 */
const getFocusedViewId = (blockElement: Element): string => {
    const focusEl = blockElement.querySelector(".av__views .item--focus");
    return focusEl?.getAttribute("data-id") ?? "";
};

/** 切换视图（不打开编辑菜单） @同步豁免: UI构建 */
const handleAvViewSwitch = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent): void => {
    const parent = target.parentElement;
    // 仅当点击的不是当前视图时才切换
    if (parent && !parent.classList.contains("b3-menu__item--current")) {
        const currentEl = ctx.avPanelElement.querySelector(".b3-menu__item--current");
        currentEl?.classList.remove("b3-menu__item--current");
        parent.classList.add("b3-menu__item--current");
        const viewId = parent.dataset.id ?? "";
        transaction(ctx.options.protyle, [{
            action: "setAttrViewBlockView", blockID: ctx.blockID, id: viewId, avID: ctx.avID
        }], [{
            action: "setAttrViewBlockView", blockID: ctx.blockID, id: getFocusedViewId(ctx.options.blockElement), avID: ctx.avID
        }]);
    }
    event.preventDefault();
    event.stopPropagation();
};

/** 编辑视图（切换+打开编辑菜单） @同步豁免: UI构建 */
const handleAvViewEdit = (ctx: IMenuPanelContext, target: HTMLElement) => {
    const parent = target.parentElement;
    if (!parent) {
        return;
    }
    const blockEl = asHTMLElement(ctx.options.blockElement);
    // 已是当前视图：直接打开编辑菜单
    if (parent.classList.contains("b3-menu__item--current")) {
        return {blockElement: blockEl, element: parent};
    }
    // 非当前视图：先切换再打开编辑菜单
    const currentEl = ctx.avPanelElement.querySelector(".b3-menu__item--current");
    currentEl?.classList.remove("b3-menu__item--current");
    parent.classList.add("b3-menu__item--current");
    const viewId = parent.dataset.id ?? "";
    transaction(ctx.options.protyle, [{
        action: "setAttrViewBlockView", blockID: ctx.blockID, id: viewId, avID: ctx.avID,
    }], [{
        action: "setAttrViewBlockView", blockID: ctx.blockID, id: getFocusedViewId(ctx.options.blockElement), avID: ctx.avID,
    }]);
    removeSiyuanMenu();
    return {blockElement: blockEl, element: parent};
};

/** 面板导航类 click 分发（go-config/go-properties/go-layout/update-view-icon） @同步豁免: UI构建 */
const dispatchNavClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent,
    getPropertiesHTML: (fields: IAVColumn[]) => string
): boolean => {
    // 导航到配置面板
    if (type === "go-config") {
        handleGoConfig(ctx, event);
        return true;
    }
    // 导航到属性面板
    if (type === "go-properties") {
        handleGoProperties(ctx, event, getPropertiesHTML);
        return true;
    }
    // 导航到布局面板
    if (type === "go-layout") {
        handleGoLayout(ctx, event);
        return true;
    }
    // 更新视图图标
    if (type === "update-view-icon") {
        handleUpdateViewIcon(ctx, target, event);
        return true;
    }
    // 设置每页显示数量
    if (type === "set-page-size") {
        setPageSize({ target, protyle: ctx.options.protyle, avID: ctx.avID, nodeElement: ctx.options.blockElement });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};

/** 视图操作类 click 分发（duplicate/delete/add/switch/edit） @同步豁免: UI构建 */
/** @显式返回类型原因: 判别联合是 Panel 导航所有者与 View 操作处理器之间的完整命令边界，必须防止 kind 被拓宽为 string。 */
const dispatchViewOpsClick = (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): ViewClickOutcome => {
    // 复制视图
    if (type === "duplicate-view") {
        handleDuplicateView(ctx, event);
        return {kind: "handled"};
    }
    // 删除视图
    if (type === "delete-view") {
        handleDeleteView(ctx, event);
        return {kind: "handled"};
    }
    // 新增视图
    if (type === "av-add") {
        handleAvAdd(ctx, event);
        return {kind: "handled"};
    }
    // 切换视图
    if (type === "av-view-switch") {
        handleAvViewSwitch(ctx, target, event);
        return {kind: "handled"};
    }
    // 编辑视图
    if (type === "av-view-edit") {
        const element = handleAvViewEdit(ctx, target);
        return element ? createOpenViewMenuOutcome(element.blockElement, element.element) : {kind: "handled"};
    }
    return {kind: "unhandled"};
};

/** 画廊+布局类 click 分发（gallery-cover/size/ratio, set-layout） @同步豁免: UI构建 */
const dispatchGalleryLayoutClick = async (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent
): Promise<boolean> => {
    // 设置画廊封面
    if (type === "set-gallery-cover") {
        setGalleryCover({ target, protyle: ctx.options.protyle, nodeElement: ctx.options.blockElement, view: asAVGallery(ctx.data.view) });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 设置画廊尺寸
    if (type === "set-gallery-size") {
        setGallerySize({ target, protyle: ctx.options.protyle, nodeElement: ctx.options.blockElement, view: asAVGallery(ctx.data.view) });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 设置画廊比例
    if (type === "set-gallery-ratio") {
        setGalleryRatio({ target, protyle: ctx.options.protyle, nodeElement: ctx.options.blockElement, view: asAVGallery(ctx.data.view) });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 切换布局类型（异步：需等待updateLayout返回新数据）
    if (type === "set-layout") {
        ctx.data = await updateLayout({ target, protyle: ctx.options.protyle, nodeElement: ctx.options.blockElement, data: ctx.data });
        ctx.fields = getFieldsByData(ctx.data);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};

/**
 * 视图+画廊+面板导航 click 事件分支总入口。
 * 覆盖：go-config, go-properties, go-layout, update-view-icon, set-page-size,
 *       duplicate-view, delete-view, av-add, av-view-switch, av-view-edit,
 *       set-gallery-cover, set-gallery-size, set-gallery-ratio, set-layout
 */
/** @显式返回类型原因: Panel 必须穷举 handled、unhandled 与 open-view-menu 三种结果，避免异步推导拓宽命令标签。 */
export const handleViewClick = async (
    ctx: IMenuPanelContext, type: string, target: HTMLElement, event: MouseEvent,
    getPropertiesHTML: (fields: IAVColumn[]) => string
): Promise<ViewClickOutcome> => {
    if (dispatchNavClick(ctx, type, target, event, getPropertiesHTML)) {
        return {kind: "handled"};
    }
    const viewOutcome = dispatchViewOpsClick(ctx, type, target, event);
    if (viewOutcome.kind !== "unhandled") {
        return viewOutcome;
    }
    return await dispatchGalleryLayoutClick(ctx, type, target, event)
        ? {kind: "handled"}
        : {kind: "unhandled"};
};
