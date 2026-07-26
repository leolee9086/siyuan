/**
 * openMenuPanel 拆分后各子模块共享的上下文接口。
 *
 * 用途：封装 openMenuPanel 函数内部闭包变量，使提取到独立文件的事件处理器
 *       能够访问原闭包中的可变状态（data、fields、tabRect、closeCB）。
 * 使用场景：openMenuPanel.drag.ts、openMenuPanel.click.*.ts 等拆分文件。
 * 关联类型：IAV、IAVColumn 来自全局类型定义。
 */
export interface IMenuPanelContext {
    options: {
        protyle: IProtyle,
        blockElement: Element,
        type: string,
        colId?: string,
        editData?: {
            previousID: string | undefined,
            colData: IAVColumn,
        },
        cellElements?: HTMLElement[],
        cb?: (avPanelElement: Element) => void
    };
    data: IAV;
    fields: IAVColumn[];
    avID: string;
    blockID: string;
    isCustomAttr: boolean;
    menuElement: HTMLElement;
    avPanelElement: HTMLElement;
    tabRect: DOMRect;
    closeCB?: () => void;
}
