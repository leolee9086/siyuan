/**
 * @fileoverview 布局工具入口文件 - 功能分布：Dock:dock-utils.ts, 序列化:layout-serialization.ts, 反序列化:layout-deserialization.ts, 窗口:window-utils.ts, UI:ui-utils.ts
 * @module layout/util
 */

import type { Tab } from "./Tab";
import type { Model } from "./Model";
import type { Layout } from "./index";
import type { Wnd } from "./Wnd";
import { fetchPost } from "../util/network/fetch";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { setStorageVal } from "../protyle/util/compatibility";
import { Editor } from "../editor";
import { newCardModel } from "../card/newCardTab";
import { App } from "../index";
import { tabRegistry } from "../registry";
import {
    getCenterLayout, getPdfLoadingMessage, isReadOnlyMode, reloadWindow,
    resetFilePositionStorage, resetDialogPositionStorage, getFilePositionStorage, getDialogPositionStorage,
    findInstanceInLayout,
} from "./util.environment";
import { isLayoutValue, isWndValue, isTabValue, isCardModelData, isValidScrollPosition, isValidEditorMode, isValidProtyleAction, toString } from "./util.guard";

/** @同步豁免: UI构建 - 需要同步遍历布局树进行查找 */
export const getInstanceById = (id: string, layout = getCenterLayout()): Tab | Layout | Wnd | undefined => {
    if (!layout) {
        return undefined;
    }
    const result = findInstanceInLayout(layout, id);
    if (isTabValue(result) || isLayoutValue(result) || isWndValue(result)) {
        return result;
    }
    return undefined;
};

/** @同步豁免: UI构建 - 涉及DOM操作和页面刷新，需要同步执行 */
export const resetLayout = (reason?: Error | string): void => {
    if (reason) {
        const errorMsg = reason instanceof Error ? reason.stack || reason.message : String(reason);
        console.error("[resetLayout] 布局重置原因:", errorMsg);
        showMessage(`布局初始化失败，需要重置布局。\n错误信息: ${errorMsg}\n\n点击确定后将刷新页面。`, 0, "error");
        return;
    }
    // 只读模式下直接刷新页面，无需清空布局配置
    if (isReadOnlyMode()) {
        reloadWindow();
        return;
    }
    // @内联回调 - 回调逻辑简单，直接内联
    // S-forge: 本地重构将 saveLayout/getAllLayout/initInternalDock 移至独立模块
    fetchPost("/api/system/setUILayout", { layout: {} }, () => {
        resetFilePositionStorage();
        setStorageVal(Constants.LOCAL_FILEPOSITION, getFilePositionStorage());
        resetDialogPositionStorage();
        setStorageVal(Constants.LOCAL_DIALOGPOSITION, getDialogPositionStorage());
        reloadWindow();
    });
};

/** @同步豁免: UI构建 - 需要同步检查DOM元素状态 */
export const pdfIsLoading = (element: HTMLElement): boolean => {
    const isLoading = element.querySelector('.layout-tab-container > [data-loading="true"]') !== null;
    if (isLoading) {
        showMessage(getPdfLoadingMessage());
    }
    return isLoading;
};

/** @同步豁免: UI构建 - 需要同步创建模型实例并初始化 */
export const newModelByInitData = (app: App, tab: Tab, json: IObject): Model | undefined => {
    // 处理自定义类型（插件等）
    if (json.instance === "Custom") {
        return createCustomModel(app, tab, json);
    }
    // 处理编辑器类型
    if (json.instance === "Editor") {
        return createEditorModel(app, tab, json);
    }
    return undefined;
};

/** @同步豁免: UI构建 - 需要同步创建模型实例 */
const createCustomModel = (app: App, tab: Tab, json: IObject): Model | undefined => {
    const cardData = json.customModelData;
    const customModelType = json.customModelType;
    // 思源卡片特殊处理
    if (customModelType === "siyuan-card" && isCardModelData(cardData)) {
        return newCardModel({ app, tab: tab, data: cardData });
    }
    if (typeof customModelType !== "string") {
        return undefined;
    }
    // 优先从全局 TabRegistry 查找
    const registryModel = tabRegistry.createModel({ app, tab, type: customModelType, data: json.customModelData });
    if (registryModel) {
        return registryModel;
    }
    // 回退：遍历插件（兼容旧插件）
    return findPluginModel(app, tab, customModelType, json.customModelData);
};

/** 从插件中查找并创建模型 */
const findPluginModel = (app: App, tab: Tab, modelType: string, modelData: unknown): Model | undefined => {
    let model: Model | undefined;
    // @内联回调 - 插件查找逻辑简单，直接内联
    // 检查插件是否注册了该模型类型
    app.plugins.find((plugin) => {
        const modelFactory = plugin.models[modelType];
        if (modelFactory) {
            model = modelFactory({ tab: tab, data: modelData });
            return true;
        }
        return false;
    });
    return model;
};

/** @同步豁免: UI构建 - 需要同步创建模型实例 */
const createEditorModel = (app: App, tab: Tab, json: IObject): Model => {
    // 当rootId等于blockId时，从action中移除CB_GET_ALL以避免重复加载
    const processedAction = processEditorAction(json);
    // 使用类型守卫验证scrollPosition和mode，无效值回退为undefined
    const scrollPosition = isValidScrollPosition(json.scrollPosition) ? json.scrollPosition : undefined;
    const mode = isValidEditorMode(json.mode) ? json.mode : undefined;
    // 使用toString确保rootId和blockId为string类型
    const rootId = toString(json.rootId);
    const blockId = toString(json.blockId);
    return new Editor({
        app, tab, rootId, blockId,
        ...(mode && { mode }),
        ...(scrollPosition && { scrollPosition }),
        action: processedAction,
    });
};

/** 处理编辑器action参数 */
const processEditorAction = (json: IObject): TProtyleAction[] => {
    const jsonAction = json.action;
    // rootId不等于blockId时，不需要特殊处理
    if (json.rootId !== json.blockId) {
        return buildActionArray(jsonAction);
    }
    // 没有action时，直接返回默认值
    if (!jsonAction) {
        return [Constants.CB_GET_FOCUS];
    }
    // 移除CB_GET_ALL并构建最终action数组
    const filteredAction = removeCbGetAll(jsonAction);
    return [...filteredAction, Constants.CB_GET_FOCUS];
};

/** 从action中移除CB_GET_ALL */
const removeCbGetAll = (action: unknown): TProtyleAction[] => {
    // action为字符串类型时直接替换
    if (typeof action === "string") {
        const cleaned = action.replace(Constants.CB_GET_ALL, "");
        // 验证清理后的字符串是否为有效的TProtyleAction
        return isValidProtyleAction(cleaned) ? [cleaned] : [];
    }
    // action为数组类型时过滤掉CB_GET_ALL并验证
    if (Array.isArray(action)) {
        return action
            .filter((item) => item !== Constants.CB_GET_ALL)
            .filter(isValidProtyleAction);
    }
    return [];
};

/** 构建action数组 */
const buildActionArray = (action: unknown): TProtyleAction[] => {
    // action为字符串类型时，验证是否为有效的TProtyleAction
    if (typeof action === "string" && action && isValidProtyleAction(action)) {
        return [action, Constants.CB_GET_FOCUS];
    }
    // action为字符串但无效，或非字符串非数组时，返回默认值
    if (typeof action === "string" || !Array.isArray(action)) {
        return [Constants.CB_GET_FOCUS];
    }
    // action为数组类型时，过滤出有效的TProtyleAction
    const validActions = action.filter(isValidProtyleAction);
    return [...validActions, Constants.CB_GET_FOCUS];
};

// 重导出，保持向后兼容

export { dockToJSON, initInternalDock, JSONToDock } from "./dock-utils";
export { saveLayout, exportLayout, getAllLayout, layoutToJSON } from "./layout-serialization";
export { JSONToCenter, JSONToLayout } from "./layout-deserialization";
export { switchWnd, getWndByLayout } from "./window-utils";
export { resizeTopBar, adjustLayout, fixWndFlex1 } from "./ui-utils";
