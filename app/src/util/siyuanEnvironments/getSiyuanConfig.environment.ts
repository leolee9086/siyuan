
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
    window.siyuan.layout.centerLayout = layout as NonNullable<typeof window.siyuan.layout.centerLayout>;
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
