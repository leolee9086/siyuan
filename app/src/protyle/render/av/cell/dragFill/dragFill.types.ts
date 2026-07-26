/** 拖拽填充目标值，附带本次事务所需的列和 DOM 定位。 */
export type DragFillTarget = IAVCellValue & {id: string, colId: string, element: HTMLElement};

/** 按目标行保持 DOM 首次出现顺序的填充值映射。 */
export type DragFillTargetsByRow = {[key: string]: DragFillTarget[]};

/** 操作生成阶段共同使用的属性视图身份与图标状态。 */
export type DragFillRenderOptions = {avID: string, showIcon: boolean};

/** 一次完整拖拽填充命令的全部输入。 */
export interface DragFillRequest {
    protyle: IProtyle;
    nodeElement: HTMLElement;
    originData: {[key: string]: IAVCellValue[]};
    originCellIds: string[];
    activeElement: Element;
}

/** 单个目标单元格生成填充操作所需的完整输入。 */
export interface DragFillStepRequest {
    target: DragFillTarget;
    source: IAVCellValue | undefined;
    avID: string;
    rowID: string;
}

/** 单个可写目标生成的数据和成对事务操作。 */
export interface DragFillStep {
    data: IAVCellValue;
    doOperation: IOperation;
    undoOperation: IOperation;
}
