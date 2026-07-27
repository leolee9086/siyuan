/** 用途：提交封闭的 Groups 事务；使用范围：隐藏、显示与清除；解耦评估：经本子域网关直达严格命令。 */
import {submitAVGroupTransaction} from "./imports";
/** 用途：定位 Groups Panel；使用范围：内容切换与清除刷新；解耦评估：经本子域网关直达定位实现。 */
import {setPosition} from "./imports";
/** 用途：读取视图字段；使用范围：日期/排序设置返回；解耦评估：经本子域网关直达元数据所有者。 */
import {getFieldsByData} from "./imports";
/** 用途：绑定 Groups 列表事件；使用范围：返回分组列表；解耦评估：经本子域网关直达当前唯一实现。 */
import {bindGroupsEvent} from "./imports";
/** 用途：绑定 Groups 数值范围；使用范围：数值设置 Panel；解耦评估：经本子域网关直达当前唯一实现。 */
import {bindGroupsNumber} from "./imports";
/** 用途：渲染 Groups 列表；使用范围：列表导航与清除刷新；解耦评估：经本子域网关直达当前唯一实现。 */
import {getGroupsHTML} from "./imports";
/** 用途：渲染 Groups 方法选择；使用范围：无分组字段和方法导航；解耦评估：经本子域网关直达当前唯一实现。 */
import {getGroupsMethodHTML} from "./imports";
/** 用途：渲染 Groups 数值范围；使用范围：数值设置 Panel；解耦评估：经本子域网关直达当前唯一实现。 */
import {getGroupsNumberHTML} from "./imports";
/** 用途：进入 Groups 日期设置；使用范围：日期动作；解耦评估：经本子域网关直达当前唯一实现。 */
import {goGroupsDate} from "./imports";
/** 用途：进入 Groups 排序设置；使用范围：排序动作；解耦评估：经本子域网关直达当前唯一实现。 */
import {goGroupsSort} from "./imports";
/** 用途：设置 Groups 方法；使用范围：方法动作；解耦评估：经本子域网关直达当前唯一实现。 */
import {setGroupMethod} from "./imports";
/** 用途：清理全局菜单；使用范围：Groups Panel 动作；解耦评估：经网关直达环境动作。 */
import {removeSiyuanMenu} from "./imports";
/** 用途：读取 Groups 文案；使用范围：显示隐藏按钮；解耦评估：经网关直达只读环境。 */
import {siyuanI18n} from "./imports";
/** 用途：清除分组本地数据；使用范围：移除全部分组；解耦评估：经网关直达唯一变换。 */
import {clearViewGroupData} from "./imports";
/** 用途：约束完整 Panel 上下文；使用范围：全部交互处理器；解耦评估：纯类型经网关直达领域声明。 */
import type {IMenuPanelContext} from "./imports";
/** 用途：约束一次完整 Groups Panel 点击消息；使用范围：公开分发入口；解耦评估：同域数据契约，不承载宿主能力。 */
import type {GroupPanelInteraction} from "./types";

/** 分组日期设置 @同步豁免: UI构建 */
const handleGoGroupsDate = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    goGroupsDate({
        target, menuElement: ctx.menuElement,
        protyle: ctx.options.protyle, blockElement: ctx.options.blockElement, data: ctx.data
    });
    ctx.fields = getFieldsByData(ctx.data);
    event.stopPropagation();
    event.preventDefault();
};

/** 分组排序设置 @同步豁免: UI构建 */
const handleGoGroupsSort = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    goGroupsSort({
        target, menuElement: ctx.menuElement,
        protyle: ctx.options.protyle, blockElement: ctx.options.blockElement, data: ctx.data
    });
    ctx.fields = getFieldsByData(ctx.data);
    event.stopPropagation();
    event.preventDefault();
};

/** 设置分组方式 @同步豁免: UI构建 */
const handleSetGroupMethod = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    setGroupMethod({
        protyle: ctx.options.protyle, fieldId: target.getAttribute("data-id") ?? "",
        data: ctx.data, menuElement: ctx.menuElement, blockElement: ctx.options.blockElement,
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 进入分组面板（含关闭旧closeCB逻辑） */
const handleGoGroups = async (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    // 存在数值范围面板时先关闭
    if (ctx.menuElement.querySelector('[data-type="avGroupRange"]') && ctx.closeCB) {
        await ctx.closeCB();
    }
    delete ctx.closeCB;
    // 已有分组字段或点击的是返回图标：显示分组列表
    const hasGroupField = (ctx.data.view.group && ctx.data.view.group.field) || target.classList.contains("block__icon");
    if (hasGroupField) {
        ctx.menuElement.innerHTML = getGroupsHTML(ctx.fields, ctx.data.view);
        bindGroupsEvent({
            protyle: ctx.options.protyle, menuElement: ctx.menuElement,
            blockElement: ctx.options.blockElement, data: ctx.data
        });
    }
    // 无分组字段：显示分组方式选择
    if (!hasGroupField) {
        ctx.menuElement.innerHTML = getGroupsMethodHTML(ctx.fields, ctx.data.view.group, ctx.data.viewType);
    }
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 进入分组方式选择面板 @同步豁免: UI构建 */
const handleGoGroupsMethod = (ctx: IMenuPanelContext, event: MouseEvent) => {
    removeSiyuanMenu();
    ctx.menuElement.innerHTML = getGroupsMethodHTML(ctx.fields, ctx.data.view.group, ctx.data.viewType);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/** 进入分组数值设置面板 @同步豁免: UI构建 */
const handleGetGroupsNumber = (ctx: IMenuPanelContext, event: MouseEvent) => {
    removeSiyuanMenu();
    ctx.menuElement.innerHTML = getGroupsNumberHTML(ctx.data.view.group);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    ctx.closeCB = bindGroupsNumber({
        protyle: ctx.options.protyle, data: ctx.data,
        menuElement: ctx.menuElement, blockElement: ctx.options.blockElement
    });
    event.preventDefault();
    event.stopPropagation();
};

/** 构建显示/隐藏全部按钮的HTML @同步豁免: UI构建 */
const buildToggleAllHTML = (showCount: number) => {
    const key = showCount === 0 ? "showAll" : "hideAll";
    const icon = showCount === 0 ? "" : "off";
    return `${siyuanI18n[key]}
<span class="fn__space"></span>
<svg><use xlink:href="#iconEye${icon}"></use></svg>`;
};

/** 切换单个分组的显示/隐藏 @同步豁免: UI构建 */
const handleHideGroup = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    removeSiyuanMenu();
    const useElement = target.firstElementChild;
    if (!useElement) {
        return;
    }
    const isHide = useElement.getAttribute("xlink:href") !== "#iconEye";
    useElement.setAttribute("xlink:href", isHide ? "#iconEye" : "#iconEyeoff");
    let oldGroupHidden: number | undefined;
    let showCount = 0;
    // 更新分组数据并统计可见分组数
    for (const item of ctx.data.view.groups ?? []) {
        // 匹配当前操作的分组项
        if (item.id === target.dataset.id) {
            oldGroupHidden = item.groupHidden;
            item.groupHidden = isHide ? 0 : 2;
        }
        // 统计可见分组数量
        if (item.groupHidden === 0) {
            showCount++;
        }
    }
    target.parentElement?.classList[isHide ? "remove" : "add"]("b3-menu__item--hidden");
    const toggleAllEl = ctx.menuElement.querySelector('[data-type="hideGroups"]');
    if (toggleAllEl) {
        toggleAllEl.innerHTML = buildToggleAllHTML(showCount);
    }
    const targetId = target.dataset.id ?? "";
    submitAVGroupTransaction(ctx.options.protyle, [{
        action: "hideAttrViewGroup", avID: ctx.data.id, blockID: ctx.blockID,
        id: targetId, data: isHide ? 0 : 2,
    }], [{
        action: "hideAttrViewGroup", avID: ctx.data.id, blockID: ctx.blockID,
        id: targetId, data: oldGroupHidden
    }]);
    event.preventDefault();
    event.stopPropagation();
};

/** 切换全部分组的显示/隐藏 @同步豁免: UI构建 */
const handleHideGroups = (ctx: IMenuPanelContext, target: HTMLElement, event: MouseEvent) => {
    removeSiyuanMenu();
    const useEl = target.querySelector("use");
    const isShow = useEl?.getAttribute("xlink:href") === "#iconEyeoff";
    target.innerHTML = buildToggleAllHTML(isShow ? 0 : 1);
    // 更新所有分组项的显示状态
    const container = target.parentElement?.parentElement;
    for (const item of ctx.data.view.groups ?? []) {
        item.groupHidden = isShow ? 2 : 0;
        const itemEl = container?.querySelector(`.b3-menu__item[data-id="${item.id}"]`);
        itemEl?.classList[isShow ? "add" : "remove"]("b3-menu__item--hidden");
        const actionUse = itemEl?.querySelector(".b3-menu__action use");
        actionUse?.setAttribute("xlink:href", `#iconEye${isShow ? "off" : ""}`);
    }
    submitAVGroupTransaction(ctx.options.protyle, [{
        action: "hideAttrViewAllGroups", avID: ctx.data.id, blockID: ctx.blockID, data: isShow,
    }], [{
        action: "hideAttrViewAllGroups", avID: ctx.data.id, blockID: ctx.blockID, data: !isShow
    }]);
    event.preventDefault();
    event.stopPropagation();
};

/** 移除所有分组 @同步豁免: UI构建 */
const handleRemoveGroups = (ctx: IMenuPanelContext, event: MouseEvent) => {
    removeSiyuanMenu();
    submitAVGroupTransaction(ctx.options.protyle, [{
        action: "removeAttrViewGroup", avID: ctx.data.id, blockID: ctx.blockID,
    }], [{
        action: "setAttrViewGroup", avID: ctx.data.id, blockID: ctx.blockID, data: ctx.data.view.group
    }]);
    clearViewGroupData(ctx.data.view);
    ctx.menuElement.innerHTML = getGroupsHTML(ctx.fields, ctx.data.view);
    setPosition(ctx.menuElement, ctx.tabRect.right - ctx.menuElement.clientWidth, ctx.tabRect.bottom, ctx.tabRect.height);
    event.preventDefault();
    event.stopPropagation();
};

/**
 * 分组相关 click 事件分支。
 * 覆盖：goGroupsDate, goGroupsSort, setGroupMethod, goGroups,
 *       goGroupsMethod, getGroupsNumber, hideGroup, hideGroups, removeGroups
 * @同步豁免: UI构建
 */
export const handleGroupsClick = async ({ctx, type, target, event}: GroupPanelInteraction) => {
    // 分组日期设置
    if (type === "goGroupsDate") {
        handleGoGroupsDate(ctx, target, event);
        return true;
    }
    // 分组排序设置
    if (type === "goGroupsSort") {
        handleGoGroupsSort(ctx, target, event);
        return true;
    }
    // 设置分组方式
    if (type === "setGroupMethod") {
        handleSetGroupMethod(ctx, target, event);
        return true;
    }
    // 进入分组面板
    if (type === "goGroups") {
        await handleGoGroups(ctx, target, event);
        return true;
    }
    // 进入分组方式选择
    if (type === "goGroupsMethod") {
        handleGoGroupsMethod(ctx, event);
        return true;
    }
    // 进入分组数值设置
    if (type === "getGroupsNumber") {
        handleGetGroupsNumber(ctx, event);
        return true;
    }
    // 切换单个分组显示/隐藏
    if (type === "hideGroup") {
        handleHideGroup(ctx, target, event);
        return true;
    }
    // 切换全部分组显示/隐藏
    if (type === "hideGroups") {
        handleHideGroups(ctx, target, event);
        return true;
    }
    // 移除所有分组
    if (type === "removeGroups") {
        handleRemoveGroups(ctx, event);
        return true;
    }
    return false;
};
