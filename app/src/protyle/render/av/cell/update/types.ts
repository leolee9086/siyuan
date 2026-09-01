/**
 * 用途：定义属性视图单元格更新端口。
 * 使用场景：粘贴与上传流程提交单元格值，但不应加载 cell 组合模块。
 * 关联类型：端口参数镜像 updateCellsValue 的业务输入，返回事务操作和文本数据。
 * 问题/改进：使用对象参数保留可选更新开关，避免低层调用方依赖实现文件。
 */
export interface IAttrViewCellUpdateOptions {
    protyle: IProtyle;
    nodeElement: HTMLElement;
    value?: unknown;
    cellElements?: HTMLElement[];
    columns?: IAVColumn[];
    html?: string;
    getOperations?: boolean;
    forceOperation?: boolean;
    replaceSelectValues?: boolean;
    stableCells?: Array<{
        groupID: string;
        rowID: string;
        colID: string;
        rowIndex: number;
        colIndex: number;
        cell: IAVCell;
        column: IAVColumn;
    }>;
    updateElements?: boolean;
}

/** 更新端口总是返回可直接累积的事务数组。 */
export interface IAttrViewCellUpdateResult {
    text: string;
    json: IAVCellValue[][];
    doOperations: IOperation[];
    undoOperations: IOperation[];
}

/** 已装配 cell 组合层发布的更新能力。 */
export type TAttrViewCellUpdate = (
    options: IAttrViewCellUpdateOptions,
) => Promise<IAttrViewCellUpdateResult>;
