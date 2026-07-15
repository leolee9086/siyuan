/**
 * 布局序列化器模块
 * 提供各种布局实例类型的序列化函数
 * @同步豁免: UI构建 - 所有序列化函数需要同步访问DOM属性和实例状态
 */
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import { Model } from "./Model";
import { Editor } from "../editor";
import { Asset } from "../asset";
import { Backlink } from "./dock/Backlink";
import { Bookmark } from "./dock/Bookmark";
import { Files } from "./dock/Files";
import { Graph } from "./dock/Graph";
import { Outline } from "./dock/outline/Outline";
import { Tag } from "./dock/Tag";
import { Search } from "../search";
import { Custom } from "./dock/Custom";
import { ErrorPlaceholder, ERROR_PLACEHOLDER_TYPE } from "./dock/ErrorPlaceholder";
import { AgentChat } from "./dock/agent/AgentChat";
import { Constants } from "../constants";
import { SerializationJSON, BreakObject } from "./layout-serialization.types";

/**
 * 序列化 Layout 实例的属性
 * @同步豁免: UI构建 - 需要同步读取DOM尺寸和类名
 */
export const serializeLayoutInstance = (layout: Layout, json: SerializationJSON): void => {
    json.direction = layout.direction;
    // 没有父布局时不需要设置尺寸（根布局）
    if (!layout.parent) {
        json.resize = layout.resize;
        json.type = layout.type;
        json.instance = "Layout";
        return;
    }
    // 检查是否为自动尺寸（flex-1 类）
    const isAutoSize = layout.element.classList.contains("fn__flex-1");
    const isVertical = layout.parent.direction === "tb";
    // S-forge: 上游 #17919 dock 宽度记忆——已记录原始宽度时优先取回，避免 maxWidth 收缩后序列化丢失原始尺寸
    json.size = isAutoSize
        ? "auto"
        : (layout.element.style.maxWidth && !isVertical
            ? layout.element.getAttribute(Constants.ATTRIBUTE_DOCK_WIDTH) + "px"
            : (isVertical ? layout.element.clientHeight : layout.element.clientWidth) + "px");
    json.resize = layout.resize;
    json.type = layout.type;
    json.instance = "Layout";
};

/**
 * 序列化 Wnd 实例的属性
 * @同步豁免: UI构建 - 需要同步读取DOM样式
 */
export const serializeWndInstance = (layout: Wnd, json: SerializationJSON): void => {
    json.resize = layout.resize;
    json.height = layout.element.style.height;
    json.width = layout.element.style.width;
    json.instance = "Wnd";
};

/** 根据 Tab 的 model 类型获取语言标识 */
const getTabLangFromModel = (model: Model | undefined): string | undefined => {
    // Files 实例对应文件树
    if (model instanceof Files) {
        return "fileTree";
    }
    // Backlink 且类型为 pin 对应反向链接
    if (model instanceof Backlink && model.type === "pin") {
        return "backlinks";
    }
    // Bookmark 实例对应书签
    if (model instanceof Bookmark) {
        return "bookmark";
    }
    // Graph 且非本地类型对应图谱视图
    if (model instanceof Graph && model.type !== "local") {
        return "graphView";
    }
    // Outline 且非本地类型对应大纲
    if (model instanceof Outline && model.type !== "local") {
        return "outline";
    }
    // Tag 实例对应标签
    if (model instanceof Tag) {
        return "tag";
    }
    if (model instanceof AgentChat) {
        return "agentChat";
    }
    return undefined;
};

/**
 * 序列化 Tab 实例的属性
 * @同步豁免: UI构建 - 需要同步读取DOM属性和类名
 */
export const serializeTabInstance = (layout: Tab, json: SerializationJSON): void => {
    // 只有存在头部元素时才序列化标签页属性
    if (layout.headElement) {
        json.title = layout.title;
        json.icon = layout.icon;
        json.docIcon = layout.docIcon;
        json.pin = layout.headElement.classList.contains("item--pin");
        json.lang = getTabLangFromModel(layout.model);
        const isActive = layout.headElement.classList.contains("item--focus");
        json.active = isActive ? true : undefined;
    }
    json.instance = "Tab";
    json.activeTime = layout.headElement?.getAttribute("data-activetime");
};

/**
 * 序列化 Editor 实例的属性
 * @同步豁免: UI构建 - 需要同步读取编辑器状态
 */
export const serializeEditorInstance = (
    layout: Editor, json: SerializationJSON, breakObj?: BreakObject
): void => {
    // 如果编辑器没有 notebookId，标记为需要重试
    if (!layout.editor.protyle.notebookId && breakObj) {
        breakObj.editor = "true";
    }
    json.notebookId = layout.editor.protyle.notebookId;
    json.blockId = layout.editor.protyle.block.id;
    json.rootId = layout.editor.protyle.block.rootID;
    json.mode = "wysiwyg";
    const showAll = layout.editor.protyle.block.showAll;
    const isNotRoot = layout.editor.protyle.block.id !== layout.editor.protyle.block.rootID;
    json.action = (showAll && isNotRoot) ? Constants.CB_GET_ALL : Constants.CB_GET_SCROLL;
    json.instance = "Editor";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeAssetInstance = (layout: Asset, json: SerializationJSON): void => {
    json.path = layout.path;
    // 如果是 PDF 文件，保存当前页码
    if (layout.pdfObject) {
        json.page = layout.pdfObject.page;
    }
    json.instance = "Asset";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeBacklinkInstance = (layout: Backlink, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.rootId = layout.rootId;
    json.type = layout.type;
    json.instance = "Backlink";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeGraphInstance = (layout: Graph, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.rootId = layout.rootId;
    json.type = layout.type;
    json.instance = "Graph";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeOutlineInstance = (layout: Outline, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.type = layout.type;
    json.isPreview = layout.isPreview;
    json.instance = "Outline";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeSearchInstance = (layout: Search, json: SerializationJSON): void => {
    json.instance = "Search";
    json.config = layout.config;
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeCustomInstance = (layout: Custom, json: SerializationJSON): void => {
    json.instance = "Custom";
    json.customModelType = layout.type;
    json.customModelData = Object.assign({}, layout.data);
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeErrorPlaceholderInstance = (
    layout: ErrorPlaceholder, json: SerializationJSON
): void => {
    json.instance = "ErrorPlaceholder";
    json.errorPlaceholderType = ERROR_PLACEHOLDER_TYPE;
    json.errorPlaceholderData = layout.toJSON();
};

/** 序列化 AgentChat 普通 Tab 的会话句柄；消息正文仍以 SessionStore 为事实来源。 */
export const serializeAgentChatInstance = (layout: AgentChat, json: SerializationJSON): void => {
    json.instance = "AgentChat";
    json.sessionId = layout.getSessionId();
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeSimpleInstance = (instanceName: string, json: SerializationJSON): void => {
    json.instance = instanceName;
};

/** 序列化容器类实例（Layout/Wnd/Tab），返回是否匹配 */
const serializeContainerInstance = (layout: Layout | Wnd | Tab, json: SerializationJSON): boolean => {
    // Layout 实例：包含方向、尺寸、类型等布局信息
    if (layout instanceof Layout) {
        serializeLayoutInstance(layout, json);
        return true;
    }
    // Wnd 实例：窗口容器，包含尺寸和 resize 信息
    if (layout instanceof Wnd) {
        serializeWndInstance(layout, json);
        return true;
    }
    // Tab 实例：标签页，包含标题、图标、激活状态等
    if (layout instanceof Tab) {
        serializeTabInstance(layout, json);
        return true;
    }
    return false;
};

/** 序列化面板类实例，返回是否匹配 */
const serializePanelInstance = (layout: Model, json: SerializationJSON): boolean => {
    // Backlink 实例：反向链接面板
    if (layout instanceof Backlink) {
        serializeBacklinkInstance(layout, json);
        return true;
    }
    // Bookmark 实例：书签面板
    if (layout instanceof Bookmark) {
        serializeSimpleInstance("Bookmark", json);
        return true;
    }
    // Files 实例：文件树面板
    if (layout instanceof Files) {
        serializeSimpleInstance("Files", json);
        return true;
    }
    // Graph 实例：图谱面板
    if (layout instanceof Graph) {
        serializeGraphInstance(layout, json);
        return true;
    }
    // Outline 实例：大纲面板
    if (layout instanceof Outline) {
        serializeOutlineInstance(layout, json);
        return true;
    }
    // Tag 实例：标签面板
    if (layout instanceof Tag) {
        serializeSimpleInstance("Tag", json);
        return true;
    }
    return false;
};

/** 序列化特殊类实例（Editor/Asset/Search/Custom/ErrorPlaceholder） */
const serializeSpecialInstance = (
    layout: Model,
    json: SerializationJSON,
    breakObj?: BreakObject
): boolean => {
    // Editor 实例：编辑器，包含文档ID、模式等
    if (layout instanceof Editor) {
        serializeEditorInstance(layout, json, breakObj);
        return true;
    }
    // Asset 实例：资源文件（如PDF），包含路径和页码
    if (layout instanceof Asset) {
        serializeAssetInstance(layout, json);
        return true;
    }
    // Search 实例：搜索面板
    if (layout instanceof Search) {
        serializeSearchInstance(layout, json);
        return true;
    }
    // Custom 实例：自定义面板（插件）
    if (layout instanceof Custom) {
        serializeCustomInstance(layout, json);
        return true;
    }
    // ErrorPlaceholder 实例：错误占位符
    if (layout instanceof ErrorPlaceholder) {
        serializeErrorPlaceholderInstance(layout, json);
        return true;
    }
    if (layout instanceof AgentChat) {
        serializeAgentChatInstance(layout, json);
        return true;
    }
    return false;
};

/**
 * 根据实例类型分发到对应的序列化函数
 * @同步豁免: UI构建 - 需要同步访问实例类型进行分发
 */
export const serializeInstance = (
    layout: Layout | Wnd | Tab | Model,
    json: SerializationJSON,
    breakObj?: BreakObject
): void => {
    // 尝试序列化容器类实例
    if (layout instanceof Layout || layout instanceof Wnd || layout instanceof Tab) {
        serializeContainerInstance(layout, json);
        return;
    }
    // 尝试序列化面板类实例
    if (serializePanelInstance(layout, json)) {
        return;
    }
    // 尝试序列化特殊类实例
    serializeSpecialInstance(layout, json, breakObj);
};
