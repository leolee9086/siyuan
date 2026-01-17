/**
 * 撤销/重做操作对。
 * 
 * @description
 * 表示一次可撤销的编辑操作，包含执行操作和反向操作两个列表。
 * - doOperations: 正向操作列表，用于重做时执行
 * - undoOperations: 反向操作列表，用于撤销时执行
 */
export interface IOperations {
    doOperations: IOperation[];
    undoOperations: IOperation[];
}
