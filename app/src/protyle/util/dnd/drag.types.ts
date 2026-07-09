/**
 * 用途：setFold 的返回类型，折叠/展开未实际发生时仅含 fold 标记，否则附带操作记录
 * 使用场景：在拖拽过程中处理折叠标题的展开与重折叠
 * 关联类型：IOperation
 */
export interface FoldResult {
    fold: number;
    doOperations?: IOperation[];
    undoOperations?: IOperation[];
}
