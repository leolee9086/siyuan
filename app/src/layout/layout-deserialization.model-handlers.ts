/**
 * 布局反序列化 Model 处理分发模块
 * 负责根据 instance 类型分发到对应的 Model 处理器
 * @同步豁免: 遗留代码 - 此模块从 layout-deserialization.ts 迁移
 */

import { App } from "../index";
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import type {ILayoutModel} from "./lifecycle/model.types";
import { Bookmark } from "./dock/Bookmark";
import { Files } from "./dock/Files";
import { Tag } from "./dock/Tag";
import {
    handleEditorInstance,
    handleAssetInstance,
    handleBacklinkInstance,
    handleGraphInstance,
    handleOutlineInstance,
    handleSearchInstance,
    handleCustomInstance,
    handleErrorPlaceholderInstance,
    handleAgentChatInstance,
} from "./layout-deserialization.handlers";
import {
    isEditorItem,
    isAssetItem,
    isBacklinkItem,
    isBookmarkItem,
    isFilesItem,
    isGraphItem,
    isOutlineItem,
    isTagItem,
    isSearchItem,
    isCustomItem,
    isErrorPlaceholderItem,
    isAgentChatItem,
    asErrorPlaceholderItem,
    isTabContainer,
} from "./layout-deserialization.guard";

/**
 * 处理编辑器和资源类型的 Model
 * @作用: 处理 Editor、Asset 类型的 Model 创建
 * @调用时机: 由 processModelItem 调用
 * @returns true 表示已处理，false 表示未匹配
 */
const handleEditorAndAssetModels = (
    app: App,
    json: Config.TUILayoutItem,
    layout: Tab
): boolean => {
    // Editor 类型：延迟加载，仅设置 DOM 属性
    if (isEditorItem(json)) {
        handleEditorInstance(json, layout);
        return true;
    }
    // Asset 类型：显示附件文件
    if (isAssetItem(json)) {
        handleAssetInstance(app, json, layout);
        return true;
    }
    return false;
};

/**
 * 处理链接和书签类型的 Model
 * @作用: 处理 Backlink、Bookmark、Files 类型的 Model 创建
 * @调用时机: 由 processModelItem 调用
 * @returns true 表示已处理，false 表示未匹配
 */
const handleLinkAndBookmarkModels = (
    app: App,
    json: Config.TUILayoutItem,
    layout: Tab
): boolean => {
    // Backlink 类型：显示反向链接面板
    if (isBacklinkItem(json)) {
        handleBacklinkInstance(app, json, layout);
        return true;
    }
    // Bookmark 类型：显示书签面板
    if (isBookmarkItem(json)) {
        layout.addModel(new Bookmark(app, layout));
        return true;
    }
    // Files 类型：显示文件树面板
    if (isFilesItem(json)) {
        layout.addModel(new Files({ app, tab: layout }));
        return true;
    }
    return false;
};

/**
 * 处理图形和大纲类型的 Model
 * @作用: 处理 Graph、Outline、Tag 类型的 Model 创建
 * @调用时机: 由 processModelItem 调用
 * @returns true 表示已处理，false 表示未匹配
 */
const handleGraphAndOutlineModels = (
    app: App,
    json: Config.TUILayoutItem,
    layout: Tab
): boolean => {
    // Graph 类型：显示关系图面板
    if (isGraphItem(json)) {
        handleGraphInstance(app, json, layout);
        return true;
    }
    // Outline 类型：显示文档大纲面板
    if (isOutlineItem(json)) {
        handleOutlineInstance(app, json, layout);
        return true;
    }
    // Tag 类型：显示标签面板
    if (isTagItem(json)) {
        layout.addModel(new Tag(app, layout));
        return true;
    }
    return false;
};

/**
 * 处理搜索和自定义类型的 Model
 * @作用: 处理 Search、Custom、ErrorPlaceholder 类型的 Model 创建
 * @调用时机: 由 processModelItem 调用
 * @returns true 表示已处理，false 表示未匹配
 */
const handleSearchAndCustomModels = (
    app: App,
    json: Config.TUILayoutItem,
    layout: Tab
): boolean => {
    if (isAgentChatItem(json)) {
        handleAgentChatInstance(app, json as { sessionId?: unknown }, layout);
        return true;
    }
    // Search 类型：显示搜索结果面板
    if (isSearchItem(json)) {
        handleSearchInstance(app, json, layout);
        return true;
    }
    // Custom 类型：延迟加载，仅设置 DOM 属性
    if (isCustomItem(json)) {
        handleCustomInstance(json, layout);
        return true;
    }
    // ErrorPlaceholder 类型：显示错误占位符
    if (isErrorPlaceholderItem(json)) {
        handleErrorPlaceholderInstance(asErrorPlaceholderItem(json), layout);
        return true;
    }
    return false;
};

/**
 * 处理 Model 类型实例（Editor、Asset、Backlink等）
 * 根据 instance 类型分发到对应处理器
 * @作用: 将 JSON 配置转换为对应的 Model 实例并添加到 Tab
 * @意图: 统一 Model 类型的创建入口，便于维护和扩展
 * @调用时机: 在 JSONToCenter 递归处理布局树时，遇到 Model 类型节点时调用
 * @同步豁免: UI构建 - 需要同步创建Model
 * @param app - 应用实例
 * @param json - 布局配置JSON
 * @param layout - 父布局容器
 */
export const processModelItem = (
    app: App,
    json: Config.TUILayoutItem,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined
): void => {
    // Model 必须添加到 Tab 容器中，非 Tab 容器直接返回
    if (!isTabContainer(layout)) {
        return;
    }
    // 按类型分组处理，找到匹配的处理器后返回
    if (handleEditorAndAssetModels(app, json, layout)) {
        return;
    }
    if (handleLinkAndBookmarkModels(app, json, layout)) {
        return;
    }
    if (handleGraphAndOutlineModels(app, json, layout)) {
        return;
    }
    handleSearchAndCustomModels(app, json, layout);
};
