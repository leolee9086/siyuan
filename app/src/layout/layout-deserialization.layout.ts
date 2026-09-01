/**
 * JSONToLayout 辅助函数模块
 * 提供布局恢复过程中的Tab处理、插件检查、URL解析等功能
 * @同步豁免: 遗留代码 - 此模块从 layout-deserialization.ts 迁移，保持原有同步行为以确保兼容性
 */
/** 用途：应用门面类型；使用范围：布局恢复需传入 App 上下文；解耦评估：通过接口抽象避免直接依赖具体 App 实现 */
import type { AppFacade } from "../app/AppFacade.types";
/** 用途：页签实例类型；使用范围：启动逻辑需操作 Tab 实例；解耦评估：直接依赖 Tab 类，后续可通过参数传递解耦 */
import { Tab } from "./Tab";
/** 用途：布局容器类型；使用范围：中心布局类型守卫与空白复用分支；解耦评估：需通过 instanceof 判断，无法通过依赖注入完全解耦 */
import { Layout } from "./index";
/** 用途：编辑器领域守卫；使用范围：安全获取 protyle 实例；解耦评估：纯类型守卫，无运行时耦合 */
import { isEditorDomain } from "../editor/model/editorDomain.types";
import { openFileById } from "../editor/utils.openFileById";
import {parseUriInfo} from "../util/uri/protocol";
import { setPanelFocus } from "./utils/setPanelFocus";
import { getAllTabs } from "./getAll";
/** 用途：按页签 ID 恢复布局实例；使用范围：缺失插件占位和初始页签激活；解耦评估：无状态布局查询已有唯一所有者，应直接引用而非经过 util 聚合入口。 */
import { getInstanceById } from "./query/layoutInstance";
import { Constants } from "../constants";
import { tabRegistry } from "../registry";
import { createErrorPlaceholder } from "./dock/errorPlaceholder/ErrorPlaceholder";
import {
    isTabInstance,
    isNonCardCustomInitData,
    getCustomModelType,
    isHTMLElement,
} from "./layout-deserialization.guard";
import {
    getFileTreeConfig,
    getSiyuanLanguages,
    checkAndMarkFirstLoad,
    getSiyuanLayout,
} from "./layout-deserialization.environment";
import { isMobile } from "../platform";
import { getWndByLayout } from "./query/layoutInstance";
import { newCenterEmptyTab } from "./tabUtil";
import {activateQueuedAVLocate, queueAVLocateRequest} from "../protyle/render/av/locate/activation/activation";
import {avRender} from "../protyle/render/av/render";

// Tab 移除处理

/**
 * 移除启动时未固定的Tab
 * @同步豁免: UI构建 - 需要同步遍历和移除Tab
 * @显式返回类型原因 明确副作用，不返回数据
 */
export const removeUnpinnedTabsOnStart = () => {
    if (isMobile) {
        return;
    }
    for (const item of getAllTabs()) {
        // 跳过无头元素的Tab
        if (!item.headElement) {
            continue;
        }
        // 跳过已固定的Tab
        if (item.headElement.classList.contains("item--pin")) {
            continue;
        }
        item.parent.removeTab(item.id, false, false, false);
    }
};

// 插件检查

/**
 * 检查插件是否已注册指定的模型类型
 * @同步豁免: UI构建 - 需要同步检查插件状态
 * @显式返回类型原因 布尔判断，需明确返回类型
 */
export const isPluginModelRegistered = (app: AppFacade, modelType: string) => {
    // 检查 tabRegistry 是否有注册
    if (tabRegistry.has(modelType)) {
        return true;
    }
    // 检查插件是否存在该模型
    return app.plugins.some(
        plugin => Object.keys(plugin.models).includes(modelType)
    );
};

/**
 * 为缺失插件的Tab创建错误占位符
 * @同步豁免: UI构建 - 需要同步创建Model
 * @显式返回类型原因 副作用函数，明确不返回值
 */
export const createMissingPluginPlaceholder = (tab: Tab, modelType: string) => {
    const languages = getSiyuanLanguages();
    const errorMessage = languages?.pluginNotFound || "Plugin not found";
    tab.addModel(createErrorPlaceholder({
        element: tab.panelElement,
        data: {
            原始类型: modelType,
            错误信息: errorMessage,
        },
    }));
};

/**
 * 处理缺失插件的Tab，创建错误占位符
 * @同步豁免: UI构建 - 需要同步遍历DOM和创建Model
 * @显式返回类型原因 明确副作用
 */
export const handleMissingPluginTabs = (app: AppFacade) => {
    const tabHeaders = document.querySelectorAll('li[data-type="tab-header"]');
    for (const item of tabHeaders) {
        // 使用类型守卫确保是 HTMLElement
        if (!isHTMLElement(item)) {
            continue;
        }
        const initData = item.getAttribute("data-initdata");
        // 跳过无初始化数据的Tab
        if (!initData) {
            continue;
        }
        const initDataObj: unknown = JSON.parse(initData);
        // 仅处理非卡片的Custom类型
        if (!isNonCardCustomInitData(initDataObj)) {
            continue;
        }
        const modelType = getCustomModelType(initDataObj);
        // 跳过无效的模型类型
        if (!modelType) {
            continue;
        }
        // 检查插件是否存在
        if (isPluginModelRegistered(app, modelType)) {
            continue;
        }
        // 获取Tab实例
        const tabId = item.getAttribute("data-id");
        if (!tabId) {
            continue;
        }
        const tab = getInstanceById(tabId);
        if (!isTabInstance(tab)) {
            continue;
        }
        // 创建错误占位符
        createMissingPluginPlaceholder(tab, modelType);
    }
};

// URL 文件打开

/**
 * 处理URL中指定的文件打开
 * @同步豁免: UI构建 - 需要同步解析URL并打开文件
 * @returns true 表示已处理URL文件打开，false 表示无需处理
 * @显式返回类型原因 明确布尔语义，供调用方条件分支判断
 */
export const handleUrlFileOpen = (app: AppFacade) => {
    const info = parseUriInfo();
    // 无指定ID时返回false
    if (!info.id) {
        return false;
    }
    if (info.avItemID) {
        queueAVLocateRequest(info.id, {
            itemID: info.avItemID,
            ...(info.avViewID ? {viewID: info.avViewID} : {}),
            ...(info.avGroupID ? {groupID: info.avGroupID} : {}),
        });
    }
    const action: TProtyleAction[] = info.avItemID
        ? [Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]
        : (info.focus
            ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS]
            : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]);
    openFileById({
        app,
        id: info.id,
        action,
        zoomIn: info.avItemID ? false : info.focus,
        /** 编辑器建立后执行排队的数据库条目定位。 */
        afterOpen: (model) => {
            const protyle = isEditorDomain(model) ? model.editor.protyle : undefined;
            if (protyle) {
                activateQueuedAVLocate({renderAV: avRender, protyle, blockID: info.id});
            }
        },
    });
    return true;
};

// Tab 激活处理

/**
 * 查找最新激活的Tab头元素
 * @同步豁免: UI构建 - 需要同步比较激活时间
 * @显式返回类型原因 可能无匹配，需明确可选
 */
export const findLatestActiveTabHeader = (
    initActiveTabs: NodeListOf<Element>
) => {
    let latestTabHeaderElement: HTMLElement | undefined;
    for (const item of initActiveTabs) {
        // 使用类型守卫确保是 HTMLElement
        if (!isHTMLElement(item)) {
            continue;
        }
        // 首次找到元素时直接赋值，后续比较激活时间取最新的
        const currentTime = latestTabHeaderElement?.dataset.activetime;
        const itemTime = item.dataset.activetime;
        // 首次遍历时 latestTabHeaderElement 为空需要赋值；后续遍历时比较激活时间，取时间戳更大（更新）的元素
        if (!latestTabHeaderElement || (itemTime && currentTime && itemTime > currentTime)) {
            latestTabHeaderElement = item;
        }
    }
    return latestTabHeaderElement;
};

/**
 * 切换到指定的Tab并显示标题
 * @同步豁免: UI构建 - 需要同步切换Tab
 * @显式返回类型原因 副作用函数，明确不返回值
 */
export const switchToTab = (htmlItem: HTMLElement) => {
    const tabId = htmlItem.getAttribute("data-id");
    if (!tabId) {
        return;
    }
    const tab = getInstanceById(tabId);
    if (!isTabInstance(tab)) {
        return;
    }
    tab.parent.switchTab(htmlItem, false, false, true, false);
    tab.parent.showHeading();
};

/**
 * 激活初始Tab并设置焦点
 * @同步豁免: UI构建 - 需要同步遍历和激活Tab
 * @param removedTabs - 需要移除的空Tab数组
 * @显式返回类型原因 明确副作用
 */
export const activateInitialTabs = (removedTabs: Tab[]) => {
    const initActiveTabs = document.querySelectorAll(
        'li[data-type="tab-header"][data-init-active="true"]'
    );
    // 切换到所有标记为初始激活的Tab
    for (const item of initActiveTabs) {
        // 使用类型守卫确保是 HTMLElement
        if (isHTMLElement(item)) {
            switchToTab(item);
        }
    }
    // 设置焦点到最新激活的Tab
    const latestTabHeaderElement = findLatestActiveTabHeader(initActiveTabs);
    // 当存在最新激活的Tab头元素时，向上查找3层父元素（Tab容器）并设置焦点
    if (latestTabHeaderElement?.parentElement?.parentElement?.parentElement) {
        setPanelFocus(latestTabHeaderElement.parentElement.parentElement.parentElement, false);
    }
    // 移除空数据的Tab
    for (const item of removedTabs) {
        item.parent.removeTab(item.id, false, false, false);
    }
};

// 启动时Tab关闭处理

/**
 * 获取启动行为模式，兼容旧版 closeTabsOnStart 布尔
 * @显式返回类型原因 需精确收窄为 0|1|2，避免推导为 number
 */
export const getTabStartupMode = () => {
    const cfg = getFileTreeConfig();
    const mode = cfg?.tabStartupMode;
    if (mode === 0 || mode === 1 || mode === 2) {
        return mode;
    }
    return cfg?.closeTabsOnStart ? 2 : 0;
};

/**
 * 判断是否应应用启动行为
 * 作用：首启或会话首次加载时生效，对应上游 OR 语义
 */
export const shouldApplyTabStartup = (isStart: boolean) => {
    return isStart || checkAndMarkFirstLoad(Constants.LOCAL_SESSION_FIRSTLOAD);
};

/**
 * 桌面空白页签复用，对应上游 18439 的 blank-tab reuse
 * @显式返回类型原因 明确布尔结果供调用方分支
 */
export const handleTabStartupBlank = (app: AppFacade, shouldApply: boolean, removedTabs: Tab[]) => {
    if (!shouldApply || getTabStartupMode() !== 1) {
        return false;
    }
    if (isMobile) {
        return false;
    }
    for (const el of document.querySelectorAll('[data-init-active="true"]')) {
        el.removeAttribute("data-init-active");
    }
    const layout = getSiyuanLayout();
    const centerLayout = layout?.centerLayout;
    if (!centerLayout || !(centerLayout instanceof Layout)) {
        return true;
    }
    const wnd = getWndByLayout(centerLayout);
    if (!wnd) {
        return true;
    }
    let blankTab = wnd.children.find((item) => !item.headElement);
    if (!blankTab) {
        blankTab = newCenterEmptyTab(app);
        wnd.addTab(blankTab, false, false);
        return true;
    }
    for (const item of wnd.children) {
        item.headElement?.classList.remove("item--focus");
        item.panelElement.classList.toggle("fn__none", item !== blankTab);
    }
    const idx = removedTabs.indexOf(blankTab);
    if (idx === -1) {
        return true;
    }
    removedTabs.splice(idx, 1);
    return true;
};

/**
 * 根据配置决定是否移除未固定的Tab
 * @同步豁免: UI构建 - 需要同步检查配置和执行移除
 * @显式返回类型原因 副作用函数
 */
export const handleCloseTabsOnStart = (isStart: boolean, shouldApply?: boolean) => {
    if (getTabStartupMode() !== 2) {
        return;
    }
    const apply = typeof shouldApply === "boolean" ? shouldApply : shouldApplyTabStartup(isStart);
    if (!apply) {
        return;
    }
    if (isMobile) {
        return;
    }
    removeUnpinnedTabsOnStart();
};
