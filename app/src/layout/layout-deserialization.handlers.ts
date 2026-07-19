/**
 * 布局反序列化实例处理器
 * 处理各种布局实例（Layout、Wnd、Tab等）的创建
 * @同步豁免: 遗留代码 - 此模块从 util.ts 迁移，保持原有同步行为以确保兼容性
 */

import { App } from "../index";
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import { Asset } from "../asset";
import { Backlink } from "./dock/Backlink";
import { Bookmark } from "./dock/Bookmark";
import { Files } from "./dock/Files";
import { Graph } from "./dock/Graph";
import { Outline } from "./dock/outline/Outline";
import { Tag } from "./dock/Tag";
import { AgentChat } from "./dock/agent/AgentChat";
import { Search } from "../search";
import { newCenterEmptyTab } from "./tabUtil";
import { createErrorPlaceholder } from "./dock/errorPlaceholder/ErrorPlaceholder";
import { isErrorPlaceholderData } from "./dock/errorPlaceholder/ErrorPlaceholder.guard";
import {
    getSiyuanLanguages,
    getSiyuanConfig,
    setSiyuanLayoutLayout
} from "./layout-deserialization.environment";
import {
    needsFlattenNestedLayout,
    hasArrayChildren,
    hasValidChildrenArray
} from "./layout-deserialization.guard";

// ============ Layout 实例处理 ============

/** 展平嵌套布局结构 @同步豁免: UI构建 - 需要同步修改JSON结构 */
const flattenNestedLayout = (json: Config.IUILayoutLayout): void => {
    while (needsFlattenNestedLayout(json)) {
        if (!hasArrayChildren(json)) {
            break;
        }
        const firstChild = json.children[0];
        if (!firstChild || !hasValidChildrenArray(firstChild)) {
            break;
        }
        // 展平嵌套布局：将孙子节点提升为子节点
        // 使用 Object.assign 避免类型断言
        Object.assign(json, { children: firstChild.children });
    }
};

/**
 * 处理 Layout 实例的创建和添加
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
export const handleLayoutInstance = (
    json: Config.IUILayoutLayout,
    layout: Layout | Wnd | Tab | undefined
): Layout | undefined => {
    flattenNestedLayout(json);
    // 根布局：直接挂载到 #layouts 元素
    if (!layout) {
        const rootLayout = new Layout(Object.assign(
            { element: document.getElementById("layouts") ?? undefined },
            json.direction !== undefined && { direction: json.direction },
            json.size !== undefined && { size: json.size },
            json.type !== undefined && { type: json.type },
            json.resize !== undefined && { resize: json.resize }
        ));
        setSiyuanLayoutLayout(rootLayout);
        return undefined;
    }
    // 子布局：创建并添加到父布局
    const child = new Layout(Object.assign(
        {},
        json.direction !== undefined && { direction: json.direction },
        json.size !== undefined && { size: json.size },
        json.type !== undefined && { type: json.type },
        json.resize !== undefined && { resize: json.resize }
    ));
    // 父布局必须是 Layout 类型才能添加子布局
    if (layout instanceof Layout) {
        layout.addLayout(child);
    }
    return child;
};

// ============ Wnd 实例处理 ============

/**
 * 处理 Wnd 实例的创建和添加
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
export const handleWndInstance = (
    app: App,
    json: Config.IUILayoutWnd,
    layout: Layout
): Wnd => {
    const child = new Wnd(app, json.resize, layout.type);
    layout.addWnd(child);
    if (json.width) {
        child.element.classList.remove("fn__flex-1");
        child.element.style.width = json.width;
    }
    if (json.height) {
        child.element.classList.remove("fn__flex-1");
        child.element.style.height = json.height;
    }
    return child;
};

// ============ Tab 实例处理 ============

/** 获取Tab标题，支持国际化 */
const getTabTitle = (json: Config.IUILayoutTab): string => {
    if (!json.title) {
        return "";
    }
    let title = json.title;
    const languages = getSiyuanLanguages();
    // 配置了lang且语言包加载完成时，使用国际化标题
    if (json.lang && languages) {
        title = languages[json.lang];
    }
    return title;
};

/** 创建Tab实例 */
const createTabInstance = (app: App, json: Config.IUILayoutTab): Tab => {
    if (!json.title) {
        return newCenterEmptyTab(app);
    }
    const title = getTabTitle(json);
    return new Tab({ icon: json.icon ?? "", docIcon: json.docIcon ?? "", title });
};

/** 应用Tab固定状态的样式 */
const applyTabPinStyles = (child: Tab, json: Config.IUILayoutTab): void => {
    if (!json.pin || !child.headElement) {
        return;
    }
    child.headElement.classList.add("item--pin");
    // 固定Tab且有图标时隐藏文本
    const hasIcon = json.docIcon || json.icon;
    const textElement = hasIcon && child.headElement
        ? child.headElement.querySelector(".item__text")
        : null;
    if (textElement) {
        textElement.classList.add("fn__none");
    }
};

/** 标记Tab的初始激活状态 */
const markTabActiveState = (child: Tab, json: Config.IUILayoutTab): void => {
    // active为true且headElement存在时标记初始激活状态
    if (json.active && child.headElement) {
        child.headElement.setAttribute("data-init-active", "true");
    }
};

/**
 * 处理 Tab 实例的创建和添加
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
export const handleTabInstance = (
    app: App, json: Config.IUILayoutTab, layout: Wnd
): Tab => {
    const child = createTabInstance(app, json);
    applyTabPinStyles(child, json);
    markTabActiveState(child, json);
    layout.addTab(child, false, false, json.activeTime);
    return child;
};

// ============ Editor 实例处理 ============

/**
 * 处理 Editor 实例（延迟加载）
 * @同步豁免: UI构建 - 需要同步设置DOM属性
 */
export const handleEditorInstance = (json: Config.IUILayoutTabEditor, layout: Tab): void => {
    if (!layout.headElement) {
        return;
    }
    const config = getSiyuanConfig();
    // 用户配置使用当前Tab打开文件时，标记Tab为未更新状态
    if (config?.fileTree?.openFilesUseCurrentTab) {
        layout.headElement.classList.add("item--unupdate");
    }
    layout.headElement.setAttribute("data-initdata", JSON.stringify(json));
};

// ============ Model 类型验证 ============

/** 验证并获取 Backlink 类型 */
const getBacklinkType = (type: unknown): "pin" | "local" =>
    type === "pin" || type === "local" ? type : "local";

/** 验证并获取 Graph 类型 */
const getGraphType = (type: unknown): "pin" | "local" | "global" =>
    type === "pin" || type === "local" || type === "global" ? type : "local";

/** 验证并获取 Outline 类型 */
const getOutlineType = (type: unknown): "pin" | "local" =>
    type === "pin" || type === "local" ? type : "local";

// ============ Model 实例处理 ============

/* eslint-disable no-trivial-wrapper/no-trivial-wrapper */
// 以下处理器虽然简单，但提供统一的模型创建接口，便于在 deserialization.ts 中通过映射表调用

/**
 * 处理 Asset 实例 - 显示附件文件
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleAssetInstance = (app: App, json: { path: string; page?: string | number }, layout: Tab): void => {
    const options: { app: App; tab: Tab; path: string; page?: string | number } = {
        app, tab: layout, path: json.path
    };
    // page 可选：仅在存在时添加到选项中，避免传递 undefined
    if (json.page !== undefined) {
        options.page = json.page;
    }
    layout.addModel(new Asset(options));
};

/**
 * 处理 Backlink 实例 - 显示反向链接面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleBacklinkInstance = (app: App, json: { blockId: string; rootId: string; type?: unknown }, layout: Tab): void => {
    layout.addModel(new Backlink({
        app, tab: layout, blockId: json.blockId, rootId: json.rootId, type: getBacklinkType(json.type)
    }));
};

/**
 * 处理 Bookmark 实例 - 显示书签面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleBookmarkInstance = (app: App, _json: unknown, layout: Tab): void => {
    layout.addModel(new Bookmark(app, layout));
};

/**
 * 处理 Files 实例 - 显示文件树面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleFilesInstance = (app: App, _json: unknown, layout: Tab): void => {
    layout.addModel(new Files({ app, tab: layout }));
};

/**
 * 处理 Graph 实例 - 显示关系图面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleGraphInstance = (app: App, json: { blockId: string; rootId: string; type?: unknown }, layout: Tab): void => {
    layout.addModel(new Graph({
        app, tab: layout, blockId: json.blockId, rootId: json.rootId, type: getGraphType(json.type)
    }));
};

/**
 * 处理 Outline 实例 - 显示文档大纲面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleOutlineInstance = (app: App, json: { blockId: string; type?: unknown; isPreview?: boolean }, layout: Tab): void => {
    layout.addModel(new Outline({
        app, tab: layout, blockId: json.blockId, type: getOutlineType(json.type), isPreview: json.isPreview ?? false
    }));
};

/**
 * 处理 Tag 实例 - 显示标签面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleTagInstance = (app: App, _json: unknown, layout: Tab): void => {
    layout.addModel(new Tag(app, layout));
};

/**
 * 处理 Search 实例 - 显示搜索结果面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
/**
 * 处理 Search 实例 - 显示搜索结果面板
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleSearchInstance = (app: App, json: { config?: unknown }, layout: Tab): void => {
    // config 必须是有效对象时才能创建 Search 实例
    // 过滤掉 null、undefined 和空对象
    if (json.config === undefined || json.config === null) {
        return;
    }
    // Search 构造函数要求 config 参数为 Config.IUILayoutTabSearchConfig 类型
    // 在反序列化上下文中，数据已通过验证，可以直接使用
    layout.addModel(new Search({
        app,
        tab: layout,
        config: json.config
    }));
};

/* eslint-enable no-trivial-wrapper/no-trivial-wrapper */

// ============ Custom 实例处理 ============

/**
 * 处理 Custom 实例（延迟加载）
 * @同步豁免: UI构建 - 需要同步设置DOM属性
 */
export const handleCustomInstance = (json: Config.IUILayoutTabCustom, layout: Tab): void => {
    if (!layout.headElement) {
        return;
    }
    const config = getSiyuanConfig();
    // 用户配置使用当前Tab打开文件时，标记Tab为未更新状态
    if (config?.fileTree?.openFilesUseCurrentTab) {
        layout.headElement.classList.add("item--unupdate");
    }
    layout.headElement.setAttribute("data-initdata", JSON.stringify(json));
};

// ============ ErrorPlaceholder 实例处理 ============

/**
 * 处理 ErrorPlaceholder 实例
 * @同步豁免: UI构建 - 需要同步创建Model
 */
export const handleErrorPlaceholderInstance = (json: { errorPlaceholderData?: unknown }, layout: Tab): void => {
    if (!isErrorPlaceholderData(json.errorPlaceholderData)) {
        return;
    }
    layout.addModel(createErrorPlaceholder({
        element: layout.panelElement,
        data: json.errorPlaceholderData,
    }));
};

/** 创建并恢复 AgentChat 普通 Tab；正文从 SessionStore 异步恢复，布局树先保持稳定。 */
export const handleAgentChatInstance = (
    app: App,
    json: { sessionId?: unknown },
    layout: Tab
): void => {
    const model = new AgentChat(app, layout);
    layout.addModel(model);
    // 普通布局 Tab 也是独立副本；其最小化动作应关闭自身，不得切换原始 Agent Dock。
    model.setFloatingCopyOptions({
        onClose: () => {
            if (layout.parent?.children.some((item) => item.id === layout.id)) {
                layout.parent.removeTab(layout.id);
            }
        },
    });
    if (typeof json.sessionId === "string" && json.sessionId) {
        void model.restoreSessionById(json.sessionId).catch((error) => {
            console.error("[layout-agent-tab] failed to restore session", error);
        });
    }
};

