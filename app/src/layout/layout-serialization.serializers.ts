/**
 * 布局序列化器模块
 * 提供各种布局实例类型的序列化函数
 * @同步豁免: UI构建 - 所有序列化函数需要同步访问DOM属性和实例状态
 */
import type {LayoutDomain, LayoutTab, LayoutWindow} from "./layout.types";
import {isLayoutDomain, isLayoutTab, isLayoutWindow} from "./layout.types.guard";
import type {ILayoutModel} from "./lifecycle/model.types";
import {applyLayoutModelSerialization} from "./lifecycle/model.serialization";
import {isLayoutSerializableModel} from "./lifecycle/model.guard";
import {isEditorDomain} from "../editor/model/editorDomain.types";
import type {EditorDomain} from "../editor/model/editorDomain.types";
import {isAssetDomain} from "../asset/asset.types";
import type {AssetDomain} from "../asset/asset.types";
import {isBacklinkDomain} from "./dock/backlink/backlink.types";
import type {BacklinkDomain} from "./dock/backlink/backlink.types";
import {isBookmarkDomain} from "./dock/bookmark/bookmark.types";
import {isFilesDomain} from "./dock/Files/eventHandlers.types";
import {isGraphDomain} from "./dock/graph/graph.types";
import type {GraphDomain} from "./dock/graph/graph.types";
import {isOutlineDomain} from "./dock/outline/types";
import type {OutlineDomain} from "./dock/outline/types";
import {isTagDomain} from "./dock/tag/tag.types";
import {isSearchDomain} from "../search/model/search.types";
import type {SearchDomain} from "../search/model/search.types";
import {isCustomDomain} from "./dock/custom/custom.types";
import type {CustomDomain} from "./dock/custom/custom.types";
import { Constants } from "../constants";
import { SerializationJSON, BreakObject } from "./layout-serialization.types";

/**
 * 序列化 Layout 实例的属性
 * @同步豁免: UI构建 - 需要同步读取DOM尺寸和类名
 */
export const serializeLayoutInstance = (layout: LayoutDomain, json: SerializationJSON): void => {
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
export const serializeWndInstance = (layout: LayoutWindow, json: SerializationJSON): void => {
    json.resize = layout.resize;
    json.height = layout.element.style.height;
    json.width = layout.element.style.width;
    json.instance = "Wnd";
};

/** 根据 Tab 的 model 类型获取语言标识 */
const getTabLangFromModel = (model: ILayoutModel | undefined): string | undefined => {
    // Files 实例对应文件树
    if (model && isFilesDomain(model)) {
        return "fileTree";
    }
    // Backlink 且类型为 pin 对应反向链接
    if (model && isBacklinkDomain(model) && model.type === "pin") {
        return "backlinks";
    }
    // Bookmark 实例对应书签
    if (model && isBookmarkDomain(model)) {
        return "bookmark";
    }
    // Graph 且非本地类型对应图谱视图
    if (model && isGraphDomain(model) && model.type !== "local") {
        return "graphView";
    }
    // Outline 且非本地类型对应大纲
    if (model && isOutlineDomain(model) && model.type !== "local") {
        return "outline";
    }
    // Tag 实例对应标签
    if (model && isTagDomain(model)) {
        return "tag";
    }
    if (model && isLayoutSerializableModel(model) && model.layoutSerialization.instance === "AgentChat") {
        return "agentChat";
    }
    return undefined;
};

/**
 * 序列化 Tab 实例的属性
 * @同步豁免: UI构建 - 需要同步读取DOM属性和类名
 */
export const serializeTabInstance = (layout: LayoutTab, json: SerializationJSON): void => {
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
    layout: EditorDomain, json: SerializationJSON, breakObj?: BreakObject
): void => {
    // notebook、块或根块尚未加载完整时，延后持久化，避免刷新后出现空白页签。
    if ((!layout.editor.protyle.notebookId || !layout.editor.protyle.block.id || !layout.editor.protyle.block.rootID) && breakObj) {
        breakObj.editor = "true";
    }
    json.notebookId = layout.editor.protyle.notebookId;
    json.blockId = layout.editor.protyle.block.id;
    json.rootId = layout.editor.protyle.block.rootID;
    json.mode = "wysiwyg";
    const showAll = layout.editor.protyle.block.showAll;
    const isNotRoot = layout.editor.protyle.block.id !== layout.editor.protyle.block.rootID;
    json.action = (showAll && isNotRoot) ? Constants.CB_GET_ALL : Constants.CB_GET_SCROLL;
    json.databaseRowId = layout.editor.protyle.element.dataset.databaseRowId;
    json.instance = "Editor";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeAssetInstance = (layout: AssetDomain, json: SerializationJSON): void => {
    json.path = layout.path;
    // 如果是 PDF 文件，保存当前页码
    if (layout.pdfObject) {
        json.page = layout.pdfObject.page;
    }
    json.instance = "Asset";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeBacklinkInstance = (layout: BacklinkDomain, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.rootId = layout.rootId;
    json.type = layout.type;
    json.instance = "Backlink";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeGraphInstance = (layout: GraphDomain, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.rootId = layout.rootId;
    json.type = layout.type;
    json.instance = "Graph";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeOutlineInstance = (layout: OutlineDomain, json: SerializationJSON): void => {
    json.blockId = layout.blockId;
    json.type = layout.type;
    json.isPreview = layout.isPreview;
    json.instance = "Outline";
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeSearchInstance = (layout: SearchDomain, json: SerializationJSON): void => {
    json.instance = "Search";
    json.config = layout.config;
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeCustomInstance = (layout: CustomDomain, json: SerializationJSON): void => {
    json.instance = "Custom";
    json.customModelType = layout.type;
    json.customModelData = Object.assign({}, layout.data);
};

/** @同步豁免: UI构建 - 数据序列化操作 */
export const serializeSimpleInstance = (instanceName: string, json: SerializationJSON): void => {
    json.instance = instanceName;
};

/** 序列化容器类实例（Layout/Wnd/Tab），返回是否匹配 */
const serializeContainerInstance = (
    layout: LayoutDomain | LayoutWindow | LayoutTab,
    json: SerializationJSON,
): boolean => {
    // Layout 实例：包含方向、尺寸、类型等布局信息
    if (isLayoutDomain(layout)) {
        serializeLayoutInstance(layout, json);
        return true;
    }
    // Wnd 实例：窗口容器，包含尺寸和 resize 信息
    if (isLayoutWindow(layout)) {
        serializeWndInstance(layout, json);
        return true;
    }
    // Tab 实例：标签页，包含标题、图标、激活状态等
    if (isLayoutTab(layout)) {
        serializeTabInstance(layout, json);
        return true;
    }
    return false;
};

/** 序列化面板类实例，返回是否匹配 */
const serializePanelInstance = (layout: ILayoutModel, json: SerializationJSON): boolean => {
    // Backlink 实例：反向链接面板
    if (isBacklinkDomain(layout)) {
        serializeBacklinkInstance(layout, json);
        return true;
    }
    // Bookmark 实例：书签面板
    if (isBookmarkDomain(layout)) {
        serializeSimpleInstance("Bookmark", json);
        return true;
    }
    // Files 实例：文件树面板
    if (isFilesDomain(layout)) {
        serializeSimpleInstance("Files", json);
        return true;
    }
    // Graph 实例：图谱面板
    if (isGraphDomain(layout)) {
        serializeGraphInstance(layout, json);
        return true;
    }
    // Outline 实例：大纲面板
    if (isOutlineDomain(layout)) {
        serializeOutlineInstance(layout, json);
        return true;
    }
    // Tag 实例：标签面板
    if (isTagDomain(layout)) {
        serializeSimpleInstance("Tag", json);
        return true;
    }
    return false;
};

/** 序列化特殊模型实例和提供自描述序列化能力的模型。 */
const serializeSpecialInstance = (
    layout: ILayoutModel,
    json: SerializationJSON,
    breakObj?: BreakObject
): boolean => {
    // 自描述模型由接口形状提供完整布局数据，不要求继承任何具体模型类。
    if (applyLayoutModelSerialization(layout, json)) {
        return true;
    }
    // Editor 实例：编辑器，包含文档ID、模式等
    if (isEditorDomain(layout)) {
        serializeEditorInstance(layout, json, breakObj);
        return true;
    }
    // Asset 实例：资源文件（如PDF），包含路径和页码
    if (isAssetDomain(layout)) {
        serializeAssetInstance(layout, json);
        return true;
    }
    // Search 实例：搜索面板
    if (isSearchDomain(layout)) {
        serializeSearchInstance(layout, json);
        return true;
    }
    // Custom 实例：自定义面板（插件）
    if (isCustomDomain(layout)) {
        serializeCustomInstance(layout, json);
        return true;
    }
    return false;
};

/**
 * 根据实例类型分发到对应的序列化函数
 * @同步豁免: UI构建 - 需要同步访问实例类型进行分发
 */
export const serializeInstance = (
    layout: LayoutDomain | LayoutWindow | LayoutTab | ILayoutModel,
    json: SerializationJSON,
    breakObj?: BreakObject
): void => {
    // 尝试序列化容器类实例
    if (isLayoutDomain(layout) || isLayoutWindow(layout) || isLayoutTab(layout)) {
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
