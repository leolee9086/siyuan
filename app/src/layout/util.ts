/**
 * @fileoverview 布局工具入口文件。复杂职责已拆到 dock、序列化、反序列化、窗口与 UI 模块。
 * @module layout/util
 */

import type { Model } from "./Model";
import { fetchPost } from "../util/network/fetch";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { setStorageVal } from "../protyle/util/compatibility";
import { Editor } from "../editor";
import {createEditor} from "../editor/factory/createEditor.factory";
import { newCardModel } from "../card/newCardTab";
import { newDatabaseRowModel } from "../editor/databaseRow";
import type { AppFacade } from "../app/AppFacade.types";
import { tabRegistry } from "../registry";
import {createCustomTabModel} from "./dock/custom/factory";
import {
    isReadOnlyMode, reloadWindow,
    resetFilePositionStorage, resetDialogPositionStorage, getFilePositionStorage, getDialogPositionStorage,
} from "./util.environment";
import {
    isCardModelData, isValidScrollPosition,
    isValidEditorMode, isValidProtyleAction, toString,
} from "./util.guard";
export {getInstanceById} from "./query/layoutInstance";

/** @同步豁免: UI构建 - 涉及 DOM 操作和页面刷新，需要同步执行 */
export const resetLayout = (reason?: Error | string): void => {
    if (reason) {
        const errorMsg = reason instanceof Error ? reason.stack || reason.message : String(reason);
        console.error("[resetLayout] 布局重置原因:", errorMsg);
        showMessage(`布局初始化失败，需要重置布局。\n错误信息: ${errorMsg}\n\n点击确定后将刷新页面。`, 0, "error");
        return;
    }
    if (isReadOnlyMode()) {
        reloadWindow();
        return;
    }
    fetchPost("/api/system/setUILayout", { layout: {} }, () => {
        resetFilePositionStorage();
        setStorageVal(Constants.LOCAL_FILEPOSITION, getFilePositionStorage());
        resetDialogPositionStorage();
        setStorageVal(Constants.LOCAL_DIALOGPOSITION, getDialogPositionStorage());
        reloadWindow();
    });
};

export {pdfIsLoading} from "./loading/pdfLoading";

/** @同步豁免: UI构建 - 需要同步创建模型实例并初始化 */
export const newModelByInitData = (app: AppFacade, tab: Tab, json: IObject): Model | undefined => {
    if (json.instance === "Custom") {
        return createCustomModel(app, tab, json);
    }
    if (json.instance === "Editor") {
        return createEditorModel(app, tab, json);
    }
    return undefined;
};

/** @同步豁免: UI构建 - 需要同步创建模型实例 */
const createCustomModel = (app: AppFacade, tab: Tab, json: IObject): Model | undefined => {
    const modelData = json.customModelData;
    const modelType = json.customModelType;
    if (modelType === "siyuan-card" && isCardModelData(modelData)) {
        return newCardModel({app, tab, data: modelData});
    }
    if (modelType === "siyuan-database-row") {
        return newDatabaseRowModel({app, tab, data: modelData});
    }
    if (typeof modelType !== "string") {
        return undefined;
    }
    const registryModel = tabRegistry.createModel({app, tab, type: modelType, data: modelData}, createCustomTabModel);
    if (registryModel) {
        return registryModel;
    }
    return findPluginModel(app, tab, modelType, modelData);
};

/** 从插件中查找并创建模型 */
const findPluginModel = (app: AppFacade, tab: Tab, modelType: string, modelData: unknown): Model | undefined => {
    let model: Model | undefined;
    app.plugins.find((plugin) => {
        const modelFactory = plugin.models[modelType];
        if (!modelFactory) {
            return false;
        }
        model = modelFactory({tab, data: modelData});
        return true;
    });
    return model;
};

/** @同步豁免: UI构建 - 需要同步创建模型实例 */
const createEditorModel = (app: AppFacade, tab: Tab, json: IObject): Model => {
    const processedAction = processEditorAction(json);
    const scrollPosition = isValidScrollPosition(json.scrollPosition) ? json.scrollPosition : undefined;
    const mode = isValidEditorMode(json.mode) ? json.mode : undefined;
    const rootId = toString(json.rootId);
    const blockId = toString(json.blockId);
    const notebookId = typeof json.notebookId === "string" ? json.notebookId : undefined;
    const databaseRowId = typeof json.databaseRowId === "string" ? json.databaseRowId : undefined;
    const editorModel = createEditor({
        app,
        tab,
        rootId,
        blockId,
        notebookId,
        ...(mode && {mode}),
        ...(scrollPosition && {scrollPosition}),
        action: processedAction,
        /** 数据库行编辑器初始化后展开属性面板并回到顶部。 */
        afterInitProtyle(editor) {
            if (!databaseRowId) {
                return;
            }
            editor.protyle.databaseAttributePanel?.expand();
            editor.protyle.contentElement.scrollTop = 0;
        },
    });
    if (databaseRowId) {
        editorModel.editor.protyle.element.dataset.databaseRowId = databaseRowId;
    }
    return editorModel;
};

/** 处理编辑器 action 参数 */
const processEditorAction = (json: IObject): TProtyleAction[] => {
    const jsonAction = json.action;
    if (json.rootId !== json.blockId) {
        return buildActionArray(jsonAction);
    }
    if (!jsonAction) {
        return [Constants.CB_GET_FOCUS];
    }
    return [...removeCbGetAll(jsonAction), Constants.CB_GET_FOCUS];
};

/** 从 action 中移除 CB_GET_ALL */
const removeCbGetAll = (action: unknown): TProtyleAction[] => {
    if (typeof action === "string") {
        const cleaned = action.replace(Constants.CB_GET_ALL, "");
        return isValidProtyleAction(cleaned) ? [cleaned] : [];
    }
    if (Array.isArray(action)) {
        return action.filter((item) => item !== Constants.CB_GET_ALL).filter(isValidProtyleAction);
    }
    return [];
};

/** 构建 action 数组 */
const buildActionArray = (action: unknown): TProtyleAction[] => {
    if (typeof action === "string" && action && isValidProtyleAction(action)) {
        return [action, Constants.CB_GET_FOCUS];
    }
    if (typeof action === "string" || !Array.isArray(action)) {
        return [Constants.CB_GET_FOCUS];
    }
    return [...action.filter(isValidProtyleAction), Constants.CB_GET_FOCUS];
};

export {switchWnd} from "./window-utils";
export {getWndByLayout} from "./query/layoutInstance";
export { resizeTopBar, adjustLayout, fixWndFlex1 } from "./ui-utils";
export { setPanelFocus } from "./utils/setPanelFocus";
