/**
 * UI工具环境封装
 * 封装所有 window 访问以符合 no-restricted-globals 规则
 * @同步豁免: 遗留代码 - 此模块从 util.ts 迁移，保持原有同步行为以确保兼容性
 */

// ============ Window 相关访问 ============

/** @同步豁免: UI构建 - 需要同步访问视口尺寸 */
export const getWindowInnerWidth = (): number => window.innerWidth;

/** @同步豁免: UI构建 - 需要同步访问视口尺寸 */
export const getWindowInnerHeight = (): number => window.innerHeight;

/** @同步豁免: UI构建 - 需要同步访问屏幕尺寸 */
export const getScreenWidth = (): number => screen.width;

// ============ 思源存储访问 ============

/**
 * 获取取消固定的插件列表
 * @同步豁免: UI构建 - 工具栏调整需要同步访问存储配置
 * @returns 取消固定的插件ID数组
 */
export const getUnpinnedPlugins = (): string[] => {
    const storage = window.siyuan?.storage;

    if (!storage) {
        return [];
    }

    return storage["local-plugintopunpin"] ?? [];
};

// ============ 思源布局访问 ============

/**
 * 获取中心布局的父布局
 * @同步豁免: UI构建 - 布局调整需要同步访问布局树
 * @returns 中心布局的父布局，如果不存在则返回 undefined
 */
export const getCenterLayoutParent = () =>
    window.siyuan?.layout?.centerLayout?.parent;

/**
 * 检查思源布局是否存在
 * @同步豁免: UI构建 - 布局调整需要同步检查布局状态
 * @returns 是否存在布局
 */
export const hasSiyuanLayout = (): boolean => !!window.siyuan?.layout;
