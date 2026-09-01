/** 用途：描述容器化转换的公开参数。使用范围：超级块、列表、引述和标注转换入口。关联类型：由 container owner 消费。 */
export type TTurnsIntoOneOptions = {
    protyle: IProtyle,
    selectsElement: Element[],
    type: TTurnIntoOne,
    level?: TTurnIntoOneSub,
    unfocus?: boolean,
    getOperations?: boolean,
    parentID?: string,
    widthSourceElement?: HTMLElement,
};

/** 用途：承载正反向事务操作。使用范围：所有分拆后的转换 owner。关联类型：可直接交给 transaction 提交器。 */
export type TTurnOperationBuffers = {
    doOperations: IOperation[],
    undoOperations: IOperation[],
};

/** 用途：描述已创建但尚未提交的转换容器。使用范围：容器 owner 的 DOM 移动和宽度操作。关联类型：保留超级块宽度来源。 */
export type TTurnIntoOneContainer = {
    id: string,
    parentElement: HTMLElement,
    widthSourceOldStyle?: string,
    widthSourceElement?: HTMLElement,
};

/** 用途：描述单个选区元素移入容器的请求。使用范围：容器转换的移动操作构造。关联类型：共享正反向操作缓冲。 */
export type TTurnIntoOneMoveItemRequest = {
    options: TTurnsIntoOneOptions,
    container: TTurnIntoOneContainer,
    parentID: string | undefined,
    item: Element,
    index: number,
    previousID?: string,
    operations: TTurnOperationBuffers,
};

/** 用途：描述完整选区移入容器的请求。使用范围：容器转换的顺序移动。关联类型：共享正反向操作缓冲。 */
export type TTurnIntoOneMoveItemsRequest = {
    options: TTurnsIntoOneOptions,
    container: TTurnIntoOneContainer,
    parentID: string | undefined,
    operations: TTurnOperationBuffers,
};

/** 用途：描述超级块宽度属性回写请求。使用范围：容器转换后的可撤销样式同步。关联类型：共享正反向操作缓冲。 */
export type TTurnIntoOneWidthRequest = {
    container: TTurnIntoOneContainer,
    operations: TTurnOperationBuffers,
};

/** 用途：描述普通段落和标题转换参数。使用范围：批量或快捷键转换入口。关联类型：由 multiple owner 消费。 */
export type TTurnsIntoTransactionOptions = {
    protyle: IProtyle,
    selectsElement?: Element[],
    nodeElement?: Element,
    type: TTurnInto,
    level?: number,
    isContinue?: boolean,
    range?: Range,
    unfocus?: boolean,
};

/** 用途：描述快捷键预处理后的选区。使用范围：批量转换 owner 的事务构造。关联类型：保留临时 WBR 的焦点范围。 */
export type TPreparedTurnsIntoSelection = {
    selectsElement: Element[],
    shouldAbort: boolean,
    range?: Range,
};

/** 用途：描述由 Lute 模板生成插入操作的请求。使用范围：普通块转换的身份替换和连续合并。关联类型：共享正反向操作缓冲。 */
export type TTurnsIntoTemplateInsertRequest = {
    options: TTurnsIntoTransactionOptions,
    item: HTMLElement,
    template: HTMLTemplateElement,
    operations: TTurnOperationBuffers,
};

/** 用途：描述单项普通块转换请求。使用范围：不连续选区逐块转换。关联类型：共享正反向操作缓冲。 */
export type TTurnsIntoIndividualRequest = {
    options: TTurnsIntoTransactionOptions,
    item: HTMLElement,
    index: number,
    previousID?: string,
    selectsElement: Element[],
    operations: TTurnOperationBuffers,
};

/** 用途：描述单项普通块转换后的身份处理结果。使用范围：不连续选区中下一个撤销插入定位。关联类型：保留原有 previousID 传播语义。 */
export type TTurnsIntoIndividualResult = {
    replacedIdentity: boolean,
    id?: string,
};

/** 用途：描述连续普通块转换请求。使用范围：连续段落或标题的合并转换。关联类型：共享正反向操作缓冲。 */
export type TTurnsIntoContinuousRequest = {
    options: TTurnsIntoTransactionOptions,
    item: HTMLElement,
    index: number,
    html: string,
    selectsElement: Element[],
    operations: TTurnOperationBuffers,
};

/** 用途：描述单块类型转换参数。使用范围：列表、引述和块级命令。关联类型：由 single owner 消费。 */
export type TTurnsOneIntoOptions = {
    protyle: IProtyle,
    nodeElement: Element,
    id: string,
    type: string,
    level?: number,
    undoElement?: {
        id: string,
        html: string,
    },
    additionalOperations?: TTurnOperationBuffers,
};

/** 用途：描述取消容器型单块转换的事务构造请求。使用范围：取消列表、引述和标注。关联类型：共享折叠和正反向操作。 */
export type TTurnsOneCancellationRequest = {
    options: TTurnsOneIntoOptions,
    oldHTML: string,
    newHTML: string,
    previousID?: string,
    parentID?: string,
    foldOperations: IOperation[],
};
