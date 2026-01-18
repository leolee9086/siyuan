/// #if !MOBILE
import { Layout } from "./index";
import { Tab } from "./Tab";
import { Editor } from "../editor";
import { Graph } from "./dock/Graph";
import { Outline } from "./dock/outline/Outline";
import { Backlink } from "./dock/Backlink";
import { Asset } from "../asset";
import { Search } from "../search";
import { Files } from "./dock/Files";
import { Bookmark } from "./dock/Bookmark";
import { Tag } from "./dock/Tag";
import { Custom } from "./dock/Custom";
import { Forwardlink } from "./dock/forwardlink/Forwardlink";
import { Protyle } from "../protyle";
import { Wnd } from "./Wnd";

import { Model } from "./Model";
import { getSafeSiyuanLayout, getSafeSiyuanConfig, getSiyuanBlockPanels } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanDialogs } from "../util/siyuanEnvironments/siyuanDialogs.environment";
/// #endif
import { getSafeSiyuanMobile } from "../util/siyuanEnvironments/mobile.environment";

/**
 * 获取当前应用中所有活跃的编辑器实例 (Protyle)。
 *
 * - 作用：遍历并收集移动端或桌面端（包括各面板、浮窗、对话框）中的所有编辑器实例。
 * - 意图：为了支持需要对所有编辑器同时生效的操作，如全局搜索替换、主题更新或状态同步。
 * - 调用时机：执行全局命令、插件需要访问所有编辑器、或应用状态变更时。
 */
export const getAllEditor = () => {
    const editors: Protyle[] = [];
    /// #if MOBILE
    const mobile = getSafeSiyuanMobile();
    if (mobile?.editor) {
        editors.push(mobile.editor);
    }
    if (mobile?.popEditor) {
        editors.push(mobile.popEditor);
    }
    /// #else
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
    /// #endif
    return editors;
};

/// #if !MOBILE
/**
 * 获取当前桌面端布局中分类好的所有 Tab 模型。
 *
 * - 作用：遍历布局树，将所有 Tab 按照类型（Editor, Graph, Asset 等）分类收集。
 * - 意图：为了方便快速访问特定类型的 Tab，无需每次都重新遍历布局树。
 * - 调用时机：布局变动后重建索引、或需要批量操作某一类 Tab 时（如关闭所有搜索页）。
 */
const pushModel = (models: IModels, model: Tab["model"]) => {
    if (model instanceof Editor) {
        models.editor.push(model);
        return;
    }
    if (model instanceof Graph) {
        models.graph.push(model);
        return;
    }
    if (model instanceof Outline) {
        models.outline.push(model);
        return;
    }
    if (model instanceof Backlink) {
        models.backlink.push(model);
        return;
    }
    if (model instanceof Asset) {
        models.asset.push(model);
        return;
    }
    if (model instanceof Search) {
        models.search.push(model);
        return;
    }
    if (model instanceof Files) {
        models.files.push(model);
        return;
    }
    if (model instanceof Bookmark) {
        models.bookmark.push(model);
        return;
    }
    if (model instanceof Tag) {
        models.tag.push(model);
        return;
    }
    if (model instanceof Custom) {
        models.custom.push(model);
        return;
    }
    if (model instanceof Forwardlink) {
        models.forwardlink.push(model);
        return;
    }
};

/**  递归遍历布局获取模型 */
const getTabsForModels = (layout: Layout, models: IModels) => {
    const children = layout.children;
    if (!children) {
        return;
    }
    for (const item of children) {
        if (item instanceof Tab) {
            pushModel(models, item.model);
            continue;
        }
        if (item instanceof Wnd) {
            for (const tab of item.children) {
                pushModel(models, tab.model);
            }
            continue;
        }
        if (item instanceof Layout) {
            getTabsForModels(item, models);
        }
    }
};

/**
 * 获取当前桌面端布局中分类好的所有 Tab 模型。
 *
 * - 作用：遍历布局树，将所有 Tab 按照类型（Editor, Graph, Asset 等）分类收集。
 * - 意图：为了方便快速访问特定类型的 Tab，无需每次都重新遍历布局树。
 * - 调用时机：布局变动后重建索引、或需要批量操作某一类 Tab 时（如关闭所有搜索页）。
 */
export const getAllModels = () => {
    const models: IModels = {
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
    };
    const layout = getSafeSiyuanLayout();
    if (layout?.layout) {
        getTabsForModels(layout.layout, models);
    }
    const layoutAny = layout as any;
    const docks = [layoutAny?.left, layoutAny?.right, layoutAny?.bottom];
    for (const dock of docks) {
        if (dock && dock.layout) {
            getTabsForModels(dock.layout, models);
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
 */
export const getAllWnds = (layout: Layout, wnds: Wnd[]) => {
    const children = layout.children;
    if (!children) {
        return;
    }
    for (const item of children) {
        if (item instanceof Wnd) {
            wnds.push(item);
            continue;
        }
        if (item instanceof Layout) {
            getAllWnds(item, wnds);
        }
    }
};

/** 递归遍历布局获取 Tab */
const getTabsForTabs = (layout: Layout, tabs: Tab[]) => {
    const children = layout.children;
    if (!children) {
        return;
    }
    for (const item of children) {
        if (item instanceof Tab) {
            tabs.push(item);
            continue;
        }
        if (item instanceof Layout) {
            getTabsForTabs(item, tabs);
        }
    }
};

/**
 * 获取中心布局区域内的所有标签页 (Tab)。
 *
 * - 作用：遍历中心布局树，收集所有 Tab 实例。
 * - 意图：提供一种扁平化访问所有中心区 Tab 的方式，不包含侧边栏 Dock。
 * - 调用时机：需要统计或操作中心区所有页面时，如“关闭所有标签页”。
 */
export const getAllTabs = () => {
    const tabs: Tab[] = [];
    const layout = getSafeSiyuanLayout();
    if (layout?.centerLayout) {
        getTabsForTabs(layout.centerLayout, tabs);
    }
    return tabs;
};

/**
 * 获取左、右、底侧边栏中的所有 Dock Tab 配置。
 *
 * - 作用：从全局配置中提取所有停靠栏的 Tab 配置信息。
 * - 意图：用于获取非中心区域的面板配置，如文件树、大纲等。
 * - 调用时机：加载布局、保存配置或重置侧边栏时。
 */
export const getAllDocks = () => {
    const docks: Config.IUILayoutDockTab[] = [];
    const layout = getSafeSiyuanConfig()?.uiLayout;
    if (!layout) {
        return docks;
    }
    if (layout.left?.data) {
        for (const item of layout.left.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    if (layout.right?.data) {
        for (const item of layout.right.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    if (layout.bottom?.data) {
        for (const item of layout.bottom.data) {
            for (const dock of item) {
                docks.push(dock);
            }
        }
    }
    return docks;
};

/// #endif
