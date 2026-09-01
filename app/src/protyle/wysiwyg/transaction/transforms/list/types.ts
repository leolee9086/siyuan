/** 用途：描述递归列表转换过程中的定位信息。使用场景：构造更新或拆分操作。关联类型：由共享递归列表命令提供转换模式。 */
export type TListContext = {
    id: string,
    nodeElement: Element,
    parentID: string,
    previousID: string | undefined,
};

/** 用途：承载同一事务的正反向操作。使用场景：列表本体与折叠状态分别收集后提交。关联类型：由列表操作请求引用。 */
export type TListOperationBuffers = {
    doOperations: IOperation[],
    undoOperations: IOperation[],
};

/** 用途：描述处理单个根列表所需的数据。使用场景：取消递归或变更列表类型时构造操作。关联类型：组合列表上下文、HTML 和操作缓存。 */
export type TListOperationRequest = {
    context: TListContext,
    newHTML: string,
    oldHTML: string,
    operations: TListOperationBuffers,
};
