/**
 * showRender 模块类型定义
 */

/** 渲染面板配置 */
export interface 渲染面板配置 {
    标题: string;
    占位符: string;
    固定时的样式?: {
        宽度: string;
        高度: string;
    };
    是否禁用: boolean;
    是否行内备注: boolean;
    类型列表: string[];
}

/** 渲染面板上下文 - 供事件处理器使用 */
export interface 渲染面板上下文 {
    protyle: IProtyle;
    renderElement: Element;
    nodeElement: HTMLElement;
    updateElements?: Element[] | undefined;
    subElement: HTMLElement;
    textElement: HTMLTextAreaElement;
    types: string[];
    是否行内备注: boolean;
    id: string;
    html: string;
    range?: Range | undefined;
}

/** 自动高度计算上下文 */
export interface 自动高度上下文 {
    textElement: HTMLTextAreaElement;
    nodeRect: DOMRect;
    types: string[];
    是否行内备注: boolean;
}


/** 按钮类型到处理函数的映射 */
export type 按钮处理器 = (上下文: 渲染面板上下文, btnElement: Element | false, 导出图片回调: () => void) => void;
