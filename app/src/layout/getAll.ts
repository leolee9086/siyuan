import type { Protyle } from "../protyle";
import type {LayoutDomain, LayoutTab, LayoutWindow} from "./layout.types";
import { Editor } from "../editor";
import {isGraphDomain} from "./dock/graph/graph.types";
import {isOutlineDomain} from "./dock/outline/types";
import {isBacklinkDomain} from "./dock/backlink/backlink.types";
import {isAssetDomain} from "../asset/asset.types";
import { Search } from "../search";
import {isFilesDomain} from "./dock/Files/eventHandlers.types";
import {isBookmarkDomain} from "./dock/bookmark/bookmark.types";
import {isTagDomain} from "./dock/tag/tag.types";
import {isCustomDomain} from "./dock/custom/custom.types";
import {isForwardlinkDomain} from "./dock/forwardlink/Forwardlink.types";
import { getSafeSiyuanLayout, getSafeSiyuanConfig, getSiyuanBlockPanels } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanDialogs } from "../util/siyuanEnvironments/siyuanDialogs.environment";
import { hasLayoutDocks } from "./getAll.guard";
import { isMobile } from "../platform";
import { getSafeSiyuanMobile } from "../util/siyuanEnvironments/mobile.environment";
import {collectLayoutTabs, collectLayoutWindows} from "./traversal/collectLayout";

/**
 * 获取当前应用中所有活跃的编辑器实例 (Protyle)。
 *
 * - 作用：遍历并收集移动端或桌面端（包括各面板、浮窗、对话框）中的所有编辑器实例。
 * - 意图：为了支持需要对所有编辑器同时生效的操作，如全局搜索替换、主题更新或状态同步。
 * - 调用时机：执行全局命令、插件需要访问所有编辑器、或应用状态变更时。
 * @同步豁免: 性能考虑
 */
export const getAllEditor = () => {
    const editors: Protyle[] = [];
    if (isMobile) {
        const mobile = getSafeSiyuanMobile();
        // 检查移动端主编辑器是否存在，存在则添加到编辑器列表
        if (mobile?.editor) {
            editors.push(mobile.editor);
        }
        // 检查移动端弹出编辑器是否存在，存在则添加到编辑器列表
        if (mobile?.popEditor) {
            editors.push(mobile.popEditor);
        }
        return editors;
    }
    const models = getAllModels();
    for (const item of models.editor) {
        editors.push(item.editor);
    }
    for (const item of models.search) {
        editors.push(item.editors.edit);
        editors.push(item.editors.unRefEdit);
    }
    for (const item of models.custom) {
        if (item.editors) {
            for (const eItem of item.editors) {
                editors.push(eItem);
            }
        }
    }
    for (const item of models.backlink) {
        for (const editorItem of item.editors) {
            editors.push(editorItem);
        }
    }
    for (const item of getSiyuanDialogs()) {
        if (item.editors) {
            for (const key of Object.keys(item.editors)) {
                const editor = item.editors[key];
                if (editor) {
                    editors.push(editor);
                }
            }
        }
    }
    for (const item of getSiyuanBlockPanels()) {
        for (const editorItem of item.editors) {
            editors.push(editorItem);
        }
    }
    return editors;
};

const createEmptyModels = (): IModels => ({
    editor: [],
    graph: [],
    asset: [],
    outline: [],
    backlink: [],
    search: [],
    inbox: [],
    files: [],
    bookmark: [],
    tag: [],
    custom: [],
    forwardlink: [],
});

/**
 * 获取当前桌面端布局中分类好的所有 Tab 模型。
 *
 * - 作用：遍历布局树，将所有 Tab 按照类型（Editor, Graph, Asset 等）分类收集。
 * - 意图：为了方便快速访问特定类型的 Tab，无需每次都重新遍历布局树。
 * - 调用时机：布局变动后重建索引、或需要批量操作某一类 Tab 时（如关闭所有搜索页）。
 */
const pushModel = (models: IModels, model: LayoutTab["model"]) => {
    // @无需注释
    if (model instanceof Editor) {
        models.editor.push(model);
        return;
    }
    // @无需注释
    if (isGraphDomain(model)) {
        models.graph.push(model);
        return;
    }
    // @无需注释
    if (isOutlineDomain(model)) {
        models.outline.push(model);
        return;
    }
    // @无需注释
    if (isBacklinkDomain(model)) {
        models.backlink.push(model);
        return;
    }
    // @无需注释
    if (isAssetDomain(model)) {
        models.asset.push(model);
        return;
    }
    // @无需注释
    if (model instanceof Search) {
        models.search.push(model);
        return;
    }
    // @无需注释
    if (isFilesDomain(model)) {
        models.files.push(model);
        return;
    }
    // @无需注释
    if (isBookmarkDomain(model)) {
        models.bookmark.push(model);
        return;
    }
    // @无需注释
    if (isTagDomain(model)) {
        models.tag.push(model);
        return;
    }
    // @无需注释
    if (isCustomDomain(model)) {
        models.custom.push(model);
        return;
    }
    // @无需注释
    if (isForwardlinkDomain(model)) {
        models.forwardlink.push(model);
        return;
    }
};

/** 递归遍历布局获取模型 */
const getTabsForModels = (layout: LayoutDomain, models: IModels) => {
    const tabs: LayoutTab[] = [];
    collectLayoutTabs(layout, tabs);
    for (const tab of tabs) {
        pushModel(models, tab.model);
    }
};

/**
 * 获取当前桌面端布局中分类好的所有 Tab 模型。
 *
 * - 作用：遍历布局树，将所有 Tab 按照类型（Editor, Graph, Asset 等）分类收集。
 * - 意图：为了方便快速访问特定类型的 Tab，无需每次都重新遍历布局树。
 * - 调用时机：布局变动后重建索引、或需要批量操作某一类 Tab 时（如关闭所有搜索页）。
 * @同步豁免: 性能考虑
 */
export const getAllModels = () => {
    if (isMobile) {
        return createEmptyModels();
    }
    const models = createEmptyModels();
    const layout = getSafeSiyuanLayout();
    // 检查主布局是否存在，存在则遍历收集模型
    if (layout?.layout) {
        getTabsForModels(layout.layout, models);
    }
    // 遍历左、右、底部停靠栏的布局
    if (hasLayoutDocks<LayoutDomain>(layout)) {
        const docks = [layout.left, layout.right, layout.bottom];
        for (const dock of docks) {
            // 检查停靠栏是否存在且有布局，存在则遍历收集模型
            if (dock?.layout) {
                getTabsForModels(dock.layout, models);
            }
        }
    }
    return models;
};

/**
 * 递归获取指定布局节点及其子节点下的所有窗口 (Wnd)。
 *
 * - 作用：深度优先遍历布局树，收集所有的 Wnd 节点。
 * - 意图：用于获取布局结构中的窗口叶子节点，忽略分割容器 (Layout)。
 * - 调用时机：布局调整、计算窗口尺寸或序列化布局时。
 * @同步豁免: 性能考虑
 */
export const getAllWnds = (layout: LayoutDomain, wnds: LayoutWindow[]) => {
    if (isMobile) {
        return;
    }
    collectLayoutWindows(layout, wnds);
};

const matchesTabModel = (model: LayoutTab["model"], type: TTab | string) => {
    // @无需注释
    if (model instanceof Search) {
        return type === "Search";
    }
    // @无需注释
    if (isAssetDomain(model)) {
        return type === "Asset";
    }
    // @无需注释
    if (model instanceof Editor) {
        return type === "Editor";
    }
    // @无需注释
    if (isGraphDomain(model)) {
        return type === "Graph";
    }
    // @无需注释
    if (isBacklinkDomain(model)) {
        return type === "Backlink";
    }
    // @无需注释
    if (isOutlineDomain(model)) {
        return type === "Outline";
    }
    // @无需注释
    if (isForwardlinkDomain(model)) {
        return type === "Forwardlink" || type === "forwardlink";
    }
    // @无需注释
    if (isCustomDomain(model)) {
        return model.type === type;
    }
    return false;
};

const matchesUninitializedTab = (tab: LayoutTab, type: TTab | string) => {
    const initData = tab.headElement?.getAttribute("data-initdata");
    if (!initData) {
        return false;
    }
    try {
        const initObj = JSON.parse(initData) as ILayoutJSON;
        return (initObj.instance === "Custom" && initObj.customModelType === type) || initObj.instance === type;
    } catch (e) {
        console.log(`getAllTabs(${type}) error:`, e);
        return false;
    }
};

const pushTabByType = (tab: LayoutTab, tabs: LayoutTab[], type?: TTab | string) => {
    if (!type) {
        tabs.push(tab);
        return;
    }
    const model = tab.model;
    if (model) {
        if (matchesTabModel(model, type)) {
            tabs.push(tab);
        }
        return;
    }
    if (matchesUninitializedTab(tab, type)) {
        tabs.push(tab);
    }
};

/**
 * 获取中心布局区域内的所有标签页 (Tab)。
 *
 * - 作用：遍历中心布局树，收集所有 Tab 实例。
 * - 意图：提供一种扁平化访问所有中心区 Tab 的方式，不包含侧边栏 Dock。
 * - 调用时机：需要统计或操作中心区所有页面时，如"关闭所有标签页"。
 * @同步豁免: 性能考虑
 */
export const getAllTabs = (type?: TTab | string) => {
    if (isMobile) {
        return [];
    }
    const tabs: LayoutTab[] = [];
    const layout = getSafeSiyuanLayout();
    // 检查中心布局是否存在，存在则遍历收集所有 Tab
    if (layout?.centerLayout) {
        const allTabs: LayoutTab[] = [];
        collectLayoutTabs(layout.centerLayout, allTabs);
        for (const tab of allTabs) {
            pushTabByType(tab, tabs, type);
        }
    }
    return tabs;
};

/**
 * 获取左、右、底侧边栏中的所有 Dock Tab 配置。
 *
 * - 作用：从全局配置中提取所有停靠栏的 Tab 配置信息。
 * - 意图：用于获取非中心区域的面板配置，如文件树、大纲等。
 * - 调用时机：加载布局、保存配置或重置侧边栏时。
 * @同步豁免: 性能考虑
 */
export const getAllDocks = () => {
    if (isMobile) {
        return [];
    }
    const docks: Config.IUILayoutDockTab[] = [];
    const layout = getSafeSiyuanConfig()?.uiLayout;
    if (!layout) {
        return docks;
    }
    // 检查左侧边栏是否有数据，有则遍历收集所有 dock 配置
    if (layout.left?.data) {
        for (const item of layout.left.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    // 检查右侧边栏是否有数据，有则遍历收集所有 dock 配置
    if (layout.right?.data) {
        for (const item of layout.right.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    // 检查底部边栏是否有数据，有则遍历收集所有 dock 配置
    if (layout.bottom?.data) {
        for (const item of layout.bottom.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    return docks;
};
