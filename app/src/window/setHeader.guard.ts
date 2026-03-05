/**
 * 用途：提供 Electron 样式类型守卫函数
 * 使用范围：需要判断 CSSStyleDeclaration 是否支持 WebkitAppRegion 的模块
 * 解耦评估：依赖 Electron 平台特定类型，桌面端无法解耦
 * @AIDONE 已移除 isHTMLElement 隐式转发，使用方现在直接从 imports.ts 导入
 */

/**
 * 类型守卫函数，用于判断 CSSStyleDeclaration 是否支持 WebkitAppRegion 属性
 * 在 Electron 环境中，style 对象会扩展 CSSStyleDeclarationElectron 接口
 */
const isElectronStyle = (style: CSSStyleDeclaration): style is CSSStyleDeclarationElectron => {
    return "WebkitAppRegion" in style;
};

export { isElectronStyle };
