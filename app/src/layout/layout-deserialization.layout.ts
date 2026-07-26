/**
 * JSONToLayout 辅助函数模块
 * 提供布局恢复过程中的Tab处理、插件检查、URL解析等功能
 * @同步豁免: 遗留代码 - 此模块从 layout-deserialization.ts 迁移，保持原有同步行为以确保兼容性
 */
import type { AppFacade } from "../app/AppFacade.types";
import { Tab } from "./Tab";
import { openFileById } from "../editor/utils.openFileById";
import { parseUriInfo } from "../util/pathName";
import { setPanelFocus } from "./utils/setPanelFocus";
import { isBrowser } from "../platform";
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
} from "./layout-deserialization.environment";
import { isMobile } from "../platform";
import {activateQueuedAVLocate, queueAVLocateRequest} from "../protyle/render/av/locate/activation/activation";
import {avRender} from "../protyle/render/av/render";

// Tab 移除处理

/**
 * 移除启动时未固定的Tab
 * @同步豁免: UI构建 - 需要同步遍历和移除Tab
 */
export const removeUnpinnedTabsOnStart = (): void => {
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
 */
export const isPluginModelRegistered = (app: AppFacade, modelType: string): boolean => {
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
 */
export const createMissingPluginPlaceholder = (tab: Tab, modelType: string): void => {
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
 */
export const handleMissingPluginTabs = (app: AppFacade): void => {
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
 */
export const handleUrlFileOpen = (app: AppFacade): boolean => {
    const info = parseUriInfo();
    // 无指定ID时返回false
    if (!info.id) {
        return false;
    }
    if (info.avItemID) {
        queueAVLocateRequest(info.id, {
            itemID: info.avItemID,
            viewID: info.avViewID,
            groupID: info.avGroupID,
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
            const protyle = model && "editor" in model ? model.editor?.protyle : undefined;
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
 */
export const findLatestActiveTabHeader = (
    initActiveTabs: NodeListOf<Element>
): HTMLElement | undefined => {
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
 */
export const switchToTab = (htmlItem: HTMLElement): void => {
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
 */
export const activateInitialTabs = (removedTabs: Tab[]): void => {
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
 * 根据配置决定是否移除未固定的Tab
 * @同步豁免: UI构建 - 需要同步检查配置和执行移除
 */
export const handleCloseTabsOnStart = (isStart: boolean): void => {
    const fileTreeConfig = getFileTreeConfig();
    // 未配置启动时关闭Tab则跳过
    if (!fileTreeConfig?.closeTabsOnStart) {
        return;
    }
    // 浏览器环境：仅首次加载时移除
    if (isBrowser && checkAndMarkFirstLoad(Constants.LOCAL_SESSION_FIRSTLOAD)) {
        removeUnpinnedTabsOnStart();
    }
    if (isBrowser) {
        return;
    }
    // 桌面环境：启动时移除
    if (isStart) {
        removeUnpinnedTabsOnStart();
    }
};
