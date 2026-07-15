/**
 * 布局反序列化类型守卫
 * 提供布局JSON数据的类型验证
 */
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import { Model } from "./Model";

// ============ 实例类型守卫 ============

/** 检查是否为 Layout 实例 */
export const isLayoutInstance = (obj: unknown): obj is Layout => {
    return obj instanceof Layout;
};

/** 检查是否为 Wnd 实例 */
export const isWndInstance = (obj: unknown): obj is Wnd => {
    return obj instanceof Wnd;
};

/** 检查是否为 Tab 实例 */
export const isTabInstance = (obj: unknown): obj is Tab => {
    return obj instanceof Tab;
};

/** 检查是否为 Model 实例 */
export const isModelInstance = (obj: unknown): obj is Model => {
    return obj instanceof Model;
};

// ============ JSON instance 字段类型守卫 ============

/** 检查 JSON 是否为 Layout 类型配置 */
export const isLayoutItem = (json: Config.TUILayoutItem): json is Config.IUILayoutLayout => {
    return json.instance === "Layout";
};

/** 检查 JSON 是否为 Wnd 类型配置 */
export const isWndItem = (json: Config.TUILayoutItem): json is Config.IUILayoutWnd => {
    return json.instance === "Wnd";
};

/** 检查 JSON 是否为 Tab 类型配置 */
export const isTabItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTab => {
    return json.instance === "Tab";
};

/** 检查 JSON 是否为 Editor 类型配置（需要 blockId） */
export const isEditorItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabEditor => {
    return json.instance === "Editor" && Boolean(json.blockId);
};

/** 检查 JSON 是否为 Asset 类型配置 */
export const isAssetItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabAsset => {
    return json.instance === "Asset";
};

/** 检查 JSON 是否为 Backlink 类型配置 */
export const isBacklinkItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabBacklink => {
    return json.instance === "Backlink";
};

/** 检查 JSON 是否为 Bookmark 类型配置 */
export const isBookmarkItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabBookmark => {
    return json.instance === "Bookmark";
};

/** 检查 JSON 是否为 Files 类型配置 */
export const isFilesItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabFiles => {
    return json.instance === "Files";
};

/** 检查 JSON 是否为 Graph 类型配置 */
export const isGraphItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabGraph => {
    return json.instance === "Graph";
};

/** 检查 JSON 是否为 Outline 类型配置 */
export const isOutlineItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabOutline => {
    return json.instance === "Outline";
};

/** 检查 JSON 是否为 Tag 类型配置 */
export const isTagItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabTag => {
    return json.instance === "Tag";
};

/** 检查 JSON 是否为 Search 类型配置 */
export const isSearchItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabSearch => {
    return json.instance === "Search";
};

/** 检查 JSON 是否为 Custom 类型配置 */
export const isCustomItem = (json: Config.TUILayoutItem): json is Config.IUILayoutTabCustom => {
    return json.instance === "Custom";
};

/** AgentChat 是 S-Forge 扩展实例，布局核心类型联合暂不收紧以保持旧 JSON 兼容。 */
export const isAgentChatItem = (json: Config.TUILayoutItem): boolean => {
    return (json as { instance?: unknown }).instance === "AgentChat";
};

/** ErrorPlaceholder 配置类型（扩展类型，不在标准定义中） */
export interface IUILayoutTabErrorPlaceholder {
    instance: "ErrorPlaceholder";
    errorPlaceholderData?: unknown;
}

/** 检查 JSON 是否为 ErrorPlaceholder 类型配置（扩展类型，不在标准定义中） */
export const isErrorPlaceholderItem = (json: Config.TUILayoutItem): boolean => {
    // ErrorPlaceholder 是扩展类型，不在 TUILayoutItem 联合类型中，只能返回 boolean
    return (json as { instance: string }).instance === "ErrorPlaceholder";
};

/** 将 JSON 转换为 ErrorPlaceholder 配置类型（需先通过 isErrorPlaceholderItem 检查） */
export const asErrorPlaceholderItem = (json: Config.TUILayoutItem): IUILayoutTabErrorPlaceholder => {
    return json as unknown as IUILayoutTabErrorPlaceholder;
};

// ============ 布局容器类型守卫 ============

/** 检查布局容器是否为 Layout 类型（用于添加子 Layout 或 Wnd） */
export const isLayoutContainer = (
    layout: Layout | Wnd | Tab | Model | undefined
): layout is Layout => {
    return layout instanceof Layout;
};

/** 检查布局容器是否为 Wnd 类型（用于添加 Tab） */
export const isWndContainer = (
    layout: Layout | Wnd | Tab | Model | undefined
): layout is Wnd => {
    return layout instanceof Wnd;
};

/** 检查布局容器是否为 Tab 类型（用于添加 Model） */
export const isTabContainer = (
    layout: Layout | Wnd | Tab | Model | undefined
): layout is Tab => {
    return layout instanceof Tab;
};

// ============ 子元素类型守卫 ============

/** 检查 JSON 是否有数组形式的 children */
export const hasArrayChildren = (
    json: Config.TUILayoutItem
): json is Config.TUILayoutItem & { children: Config.TUILayoutItem[] } => {
    return "children" in json && Array.isArray(json.children);
};

/** 检查 JSON 是否有对象形式的 children（非空） */
export const hasObjectChildren = (
    json: Config.TUILayoutItem
): json is Config.TUILayoutItem & { children: Config.TUILayoutItem } => {
    if (!("children" in json)) {
        return false;
    }
    const children = json.children;
    if (Array.isArray(children)) {
        return false;
    }
    if (!children || typeof children !== "object") {
        return false;
    }
    return Object.keys(children).length > 0;
};

/** 检查 JSON 是否有空的 children */
export const hasEmptyChildren = (json: Config.TUILayoutItem): boolean => {
    if (!("children" in json)) {
        return false;
    }
    const children = json.children;
    if (Array.isArray(children)) {
        return children.length === 0;
    }
    if (!children || typeof children !== "object") {
        return true;
    }
    return Object.keys(children).length === 0;
};

// ============ 嵌套布局检测 ============

/** 检查是否需要展平嵌套布局结构 */
export const needsFlattenNestedLayout = (json: Config.TUILayoutItem): boolean => {
    if (!hasArrayChildren(json)) {
        return false;
    }
    if (json.children.length !== 1) {
        return false;
    }
    const firstChild = json.children[0];
    if (!firstChild) {
        return false;
    }
    if (firstChild.instance !== "Layout") {
        return false;
    }
    if (firstChild.type !== "normal") {
        return false;
    }
    if (!("children" in firstChild) || !Array.isArray(firstChild.children)) {
        return false;
    }
    return firstChild.children.length === 1;
};

// ============ Custom Tab 类型守卫 ============

/** 检查初始化数据是否为 Custom 类型且非卡片 */
export const isNonCardCustomInitData = (initDataObj: unknown): boolean => {
    if (!initDataObj || typeof initDataObj !== "object") {
        return false;
    }
    const data = initDataObj as Record<string, unknown>;
    return data.instance === "Custom" && data.customModelType !== "siyuan-card";
};

/** 获取 Custom 类型的 customModelType */
export const getCustomModelType = (initDataObj: unknown): string | undefined => {
    if (!initDataObj || typeof initDataObj !== "object") {
        return undefined;
    }
    const data = initDataObj as Record<string, unknown>;
    if (typeof data.customModelType === "string") {
        return data.customModelType;
    }
    return undefined;
};

// ============ JSON 数据类型守卫 ============

/** 检查firstChild是否包含有效的children数组 */
export const hasValidChildrenArray = (firstChild: unknown): firstChild is { children: Config.TUILayoutItem[] } => {
    if (!firstChild || typeof firstChild !== "object") {
        return false;
    }
    const child = firstChild as Record<string, unknown>;
    if (!("children" in child) || !Array.isArray(child.children)) {
        return false;
    }
    return true;
};

/** 检查是否为有效的Backlink类型 */
export const isBacklinkType = (type: unknown): type is "pin" | "local" => {
    return type === "pin" || type === "local";
};

/** 检查是否为有效的Graph类型 */
export const isGraphType = (type: unknown): type is "pin" | "local" | "global" => {
    return type === "pin" || type === "local" || type === "global";
};

/** 检查是否为有效的Outline类型 */
export const isOutlineType = (type: unknown): type is "pin" | "local" => {
    return type === "pin" || type === "local";
};

// ============ DOM 元素类型守卫 ============

/**
 * 检查是否为 HTMLElement
 * @param value - 待检查的值
 * @returns 如果是 HTMLElement 则返回 true
 */
export const isHTMLElement = (value: unknown): value is HTMLElement => {
    return value instanceof HTMLElement;
};

// ============ 安全属性获取器 ============

/**
 * 安全获取对象的 children 属性
 * @param obj - 待获取的对象
 * @returns children 数组，如果不存在或不是数组则返回空数组
 */
export const getObjectChildren = (obj: unknown): unknown[] => {
    if (!obj || typeof obj !== "object") {
        return [];
    }
    const record = obj as Record<string, unknown>;
    if (!("children" in record) || !Array.isArray(record.children)) {
        return [];
    }
    return record.children;
};

/**
 * 从 JSON 中安全获取对象形式的 children
 * 用于避免类型收窄后的 never 类型问题
 * @param json - 布局配置项
 * @returns 对象形式的 children，如果不存在则返回 undefined
 */
export const getObjectChildrenFromJson = (
    json: Config.TUILayoutItem
): Config.TUILayoutItem | undefined => {
    if (!("children" in json)) {
        return undefined;
    }
    const children = json.children;
    // 数组形式不是对象形式
    if (Array.isArray(children)) {
        return undefined;
    }
    // 非对象或空对象
    if (!children || typeof children !== "object" || Object.keys(children).length === 0) {
        return undefined;
    }
    return children as Config.TUILayoutItem;
};
