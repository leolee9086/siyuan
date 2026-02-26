/**
 * bindEditEvent 拆分后各辅助函数共享的上下文接口。
 *
 * 用途：封装 bindEditEvent 函数内部的闭包变量，使提取到独立文件的
 *       事件绑定辅助函数能够访问原闭包中的状态。
 * 使用场景：col.editPanel.bind.ts 中的辅助函数。
 */
export interface IBindEditContext {
    protyle: IProtyle;
    data: IAV;
    blockID: string;
    menuElement: HTMLElement;
    isCustomAttr: boolean;
    colId: string;
    colData: IAVColumn;
    avID: string;
    nameElement: HTMLInputElement;
    /** 封装 getEditHTML + bindEditEvent 的刷新回调，避免循环依赖 */
    refreshEditPanel: () => void;
}
