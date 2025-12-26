/**
 * 类型守卫函数，用于判断 CSSStyleDeclaration 是否支持 WebkitAppRegion 属性
 * 在 Electron 环境中，style 对象会扩展 CSSStyleDeclarationElectron 接口
 */
const isElectronStyle = (style: CSSStyleDeclaration): style is CSSStyleDeclarationElectron => {
    return "WebkitAppRegion" in style;
};

/**
 * 类型守卫函数，用于判断 Element 是否为 HTMLElement
 */
const isHTMLElement = (element: Element | null): element is HTMLElement => {
    return element !== null && "style" in element;
};

export { isElectronStyle, isHTMLElement };
