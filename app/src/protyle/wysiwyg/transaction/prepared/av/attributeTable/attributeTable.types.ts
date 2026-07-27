/** 属性表复合事务的完整提交数据。 */
export interface AVAttributeTableCommit {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations?: IOperation[];
    callback?: () => void;
}
