/**
 * showColMenu 拆分后各辅助函数共享的上下文接口。
 *
 * 用途：封装 showColMenu 函数内部的闭包变量，使提取到独立文件的
 *       菜单构建辅助函数能够访问原闭包中的状态。
 * 使用场景：col.showColMenu.ts 中的辅助函数。
 * 关联类型：IProtyle（全局）、TAVCol（全局 AV 列类型联合）。
 */
export interface IShowColMenuContext {
    protyle: IProtyle;
    blockElement: Element;
    cellElement: HTMLElement;
    type: TAVCol;
    colId: string;
    avID: string;
    blockID: string;
    viewID: string;
    oldValue: string;
    oldDesc: string;
}
