
import { isCenterLayout } from "./getSiyuanConfig.guard";

/**
 * 获取配置项的工具函数
 * @param path 配置项的路径，例如 "editor.fontSize" 或 "appearance.themeDark"
 * @returns 返回配置内容
 */
export const getSiyuanConfig = () => {
    if (!window.siyuan?.config) {
        throw ("[getConfig] window.siyuan.config 不存在");
    }
    return window.siyuan.config;
};

/**
 * 获取配置项的工具函数
 * @returns 如果存在则返回对应的值，否则返回 undefined
 */
export const getSiyuanUser = () => {
    if (!window.siyuan?.user) {
        throw ("[getConfig] window.siyuan.config 不存在");
    }
    return window.siyuan.user;
};

/**
 * 检查 window.siyuan.user 是否存在（安全版本，不抛异常）
 * @returns 如果用户已登录返回 true，否则返回 false
 */
export const hasSiyuanUser = (): boolean => {
    return !!window.siyuan?.user;
};

/**
 * 获取配置项的工具函数
 * @returns 如果存在则返回对应的值，否则返回 undefined
 */
export const getSiyuanStorage = () => {
    if (!window.siyuan?.storage) {
        throw ("[getConfig] window.siyuan.storage 不存在");
    }
    return window.siyuan.storage;
};

/**
 * 获取 window.siyuan.layout
 * @returns layout 对象
 */
export const getSiyuanLayout = () => {
    if (!window.siyuan?.layout) {
        throw ("[getSiyuanLayout] window.siyuan.layout 不存在");
    }
    return window.siyuan.layout;
};

/**
 * 设置 window.siyuan.emojis
 * @param emojis emoji 列表
 */
export const setSiyuanEmojis = (emojis: IEmoji[]) => {
    window.siyuan.emojis = emojis;
};

/**
 * 设置 window.siyuan.layout.centerLayout
 * @param layout layout 对象 (使用 unknown 类型避免循环依赖)
 */
export const setSiyuanLayoutCenterLayout = (layout: unknown) => {
    if (!window.siyuan?.layout) {
        throw ("[setSiyuanLayoutCenterLayout] window.siyuan.layout 不存在");
    }
    if (!isCenterLayout(layout)) {
        throw ("[setSiyuanLayoutCenterLayout] layout 参数无效");
    }
    window.siyuan.layout.centerLayout = layout;
};

/**
 * 获取 window.siyuan.backStack
 * @returns backStack 列表
 */
export const getSiyuanBackStack = () => {
    return window.siyuan?.backStack || [];
};

/**
 * 获取 window.siyuan.notebooks
 * @returns notebooks 列表
 */
export const getSiyuanNotebooks = () => {
    if (!window.siyuan?.notebooks) {
        throw ("[getSiyuanNotebooks] window.siyuan.notebooks 不存在");
    }
    return window.siyuan.notebooks;
};

/**
 * 设置 window.siyuan.notebooks
 * @param notebooks notebooks 列表
 */
export const setSiyuanNotebooks = (notebooks: INotebook[]) => {
    if (!window.siyuan) {
        throw ("[setSiyuanNotebooks] window.siyuan 不存在");
    }
    window.siyuan.notebooks = notebooks;
};

/**
 * 获取 window.siyuan.blockPanels
 * @returns blockPanels 列表
 */
export const getSiyuanBlockPanels = () => {
    if (!window.siyuan?.blockPanels) {
        throw ("[getSiyuanBlockPanels] window.siyuan.blockPanels 不存在");
    }
    return window.siyuan.blockPanels;
};

/**
 * 获取 window.siyuan 的键盘修饰键状态
 */
export const getSiyuanKeyboardState = () => {
    return {
        ctrlIsPressed: window.siyuan?.ctrlIsPressed ?? false,
        shiftIsPressed: window.siyuan?.shiftIsPressed ?? false,
        altIsPressed: window.siyuan?.altIsPressed ?? false,
    };
};

/**
 * 获取 window.siyuan.dragElement（当前拖拽元素）
 */
export const getSiyuanDragElement = (): HTMLElement | undefined => {
    return window.siyuan?.dragElement;
};

/**
 * 设置 window.siyuan.dragElement
 * @param element 拖拽元素
 */
export const setSiyuanDragElement = (element: HTMLElement | undefined) => {
    if (!window.siyuan) {
        throw ("[setSiyuanDragElement] window.siyuan 不存在");
    }
    window.siyuan.dragElement = element;
};

/**
 * 检查 window.siyuan.config 是否存在
 */
export const hasSiyuanConfig = (): boolean => {
    return !!window.siyuan?.config;
};

/**
 * 获取 window.siyuan.menus（可能为 undefined）
 */
export const getSiyuanMenus = () => {
    return window.siyuan?.menus;
};

/**
 * 获取 window.siyuan.zIndex
 * @returns 当前的 zIndex 值
 */
export const getSiyuanZIndex = (): number => {
    return window.siyuan?.zIndex ?? 0;
};

/**
 * 递增并返回新的 zIndex 值
 * @returns 递增后的 zIndex 值
 */
export const incrementSiyuanZIndex = (): number => {
    if (!window.siyuan) {
        throw ("[incrementSiyuanZIndex] window.siyuan 不存在");
    }
    return ++window.siyuan.zIndex;
};

/**
 * 安全获取 window.siyuan.storage (如果不存在返回 undefined)
 */
export const getSafeSiyuanStorage = () => {
    return window.siyuan?.storage;
};

/**
 * 获取指定 URL 的 reqId
 * @param url API 路径
 * @returns 对应的 reqId，不存在则返回 undefined
 */
export const getSiyuanReqId = (url: string): number | undefined => {
    return window.siyuan?.reqIds?.[url];
};

/**
 * 设置指定 URL 的 reqId
 * @param url API 路径
 * @param reqId 请求 ID（通常是时间戳）
 */
export const setSiyuanReqId = (url: string, reqId: number) => {
    if (!window.siyuan) {
        throw ("[setSiyuanReqId] window.siyuan 不存在");
    }
    if (!window.siyuan.reqIds) {
        window.siyuan.reqIds = {};
    }
    window.siyuan.reqIds[url] = reqId;
};

/**
 * 获取 window.siyuan.editorIsFullscreen
 */
export const getSiyuanEditorIsFullscreen = () => {
    return window.siyuan?.editorIsFullscreen;
};

/**
 * 设置 window.siyuan.editorIsFullscreen
 */
export const setSiyuanEditorIsFullscreen = (isFullscreen: boolean) => {
    if (window.siyuan) {
        window.siyuan.editorIsFullscreen = isFullscreen;
    }
};

/**
 * 设置 window.siyuan.hideBreadcrumb
 */
export const setSiyuanHideBreadcrumb = (hide: boolean) => {
    if (window.siyuan) {
        window.siyuan.hideBreadcrumb = hide;
    }
};

/**
 * 获取插件的自定义快捷键
 * @param pluginName 插件名称
 * @param toolbarItemName 工具栏项名称
 * @returns 自定义快捷键字符串，如果不存在则返回 undefined
 */
export const getPluginCustomHotkey = (pluginName: string, toolbarItemName: string): string | undefined => {
    const keymapPlugin = window.siyuan?.config?.keymap?.plugin;
    if (!keymapPlugin) {
        return undefined;
    }
    const pluginKeymap = keymapPlugin[pluginName];
    if (!pluginKeymap) {
        return undefined;
    }
    const itemKeymap = pluginKeymap[toolbarItemName];
    if (!itemKeymap) {
        return undefined;
    }
    return itemKeymap.custom;
};

/**
 * 获取原始的 window.siyuan.languages 对象
 * 
 * 注意：此函数返回原始对象，不是 Proxy。
 * 主要用于 IPC 通信场景，因为 Proxy 对象无法通过结构化克隆算法传输。
 * 普通的 i18n 访问请使用 siyuanI18n 代理对象。
 * 
 * @returns languages 对象
 */
export const getSiyuanLanguages = () => {
    if (!window.siyuan?.languages) {
        throw ("[getSiyuanLanguages] window.siyuan.languages 不存在");
    }
    return window.siyuan.languages;
};

/**
 * 获取 window.siyuan.config.uiLayout
 * @returns uiLayout 对象，可能为 undefined
 */
export const getSiyuanUILayout = () => {
    return window.siyuan?.config?.uiLayout;
};

/**
 * 设置 window.siyuan.config.uiLayout
 * @param layout 新的 uiLayout 配置
 */
export const setSiyuanUILayout = (layout: Config.IUiLayout) => {
    if (!window.siyuan?.config) {
        throw ("[setSiyuanUILayout] window.siyuan.config 不存在");
    }
    window.siyuan.config.uiLayout = layout;
};
