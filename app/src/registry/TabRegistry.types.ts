/**
 * TabRegistry.types.ts - Tab 注册表类型定义
 */

/** 自定义页签初始化回调实际使用的模型结构，不依赖 Custom class。 */
export interface ICustomTabModel {
    element: Element;
    tab: {
        panelElement: HTMLElement;
    };
    data: unknown;
    type: string;
    editors: IProtyle[];
}

/**
 * Tab 注册信息
 */
export interface TabRegistration {
    /** 唯一类型标识 */
    type: string;
    /** 初始化函数 */
    init: (model: ICustomTabModel) => void;
    /** 销毁回调 */
    destroy?: () => void;
    /** 销毁前回调 */
    beforeDestroy?: () => void;
    /** 调整大小回调 */
    resize?: () => void;
    /** 更新回调 */
    update?: () => void;
}
