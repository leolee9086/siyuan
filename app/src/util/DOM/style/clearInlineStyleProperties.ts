/** 用途：导出图片背景场景的内联样式清单；使用范围：切换背景前清理旧背景属性；解耦评估：常量定义与业务模块解耦，跨模块复用可避免硬编码散落。 */
const BACKGROUND_STYLE_PROPERTIES = [
    "background",
    "background-image",
    "background-position",
    "background-size",
    "background-repeat",
    "background-color",
    "background-origin",
    "background-clip",
    "background-attachment",
    "background-blend-mode",
] as const;

/**
 * 作用：清空元素背景相关的内联样式。
 * 意图：统一背景样式清理逻辑，避免图像背景和图案背景切换时相互污染。
 * 调用时机：每次应用新背景前。
 * @同步豁免: 需要绝对同步的DOM访问 - 样式清理必须在同一调用栈内完成，确保后续 setProperty 不受旧值干扰。
 */
export const clearElementBackgroundStyle = (element: HTMLElement) => {
    for (const property of BACKGROUND_STYLE_PROPERTIES) {
        element.style.removeProperty(property);
    }
};
