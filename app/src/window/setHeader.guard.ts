import { isHTMLElement } from "../util/DOM/element.guard";

/**
 * 类型守卫函数，用于判断 CSSStyleDeclaration 是否支持 WebkitAppRegion 属性
 * 在 Electron 环境中，style 对象会扩展 CSSStyleDeclarationElectron 接口
 */
const isElectronStyle = (style: CSSStyleDeclaration): style is CSSStyleDeclarationElectron => {
    return "WebkitAppRegion" in style;
};

export { isElectronStyle, isHTMLElement };
