/**
 * 模板选择功能 - 类型定义
 */

/** 模板选择面板的状态 */
export interface ITemplateState {
    previewPath: string;
}



/** 事件处理器上下文 - 统一的参数类型 */
export interface IHandlerContext {
    /** 面板状态 */
    state: ITemplateState;
    /** 预览区域元素 */
    previewElement: Element;
    /** Protyle 实例 */
    protyle: IProtyle;
    /** 子面板根元素 */
    subElement: HTMLElement;
    /** 列表容器元素 */
    listElement: Element;
    /** 输入框元素 */
    inputElement: HTMLInputElement;
    /** 当前编辑节点元素 */
    nodeElement: HTMLElement;
    /** 当前选区范围 */
    range: Range;
}
