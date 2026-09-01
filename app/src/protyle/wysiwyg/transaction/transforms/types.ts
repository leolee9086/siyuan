/** 用途：描述附加的可撤销事务操作。使用场景：输入转换与区块转换合并提交。关联类型：被引述转换和更新事务共同消费。 */
export type TAdditionalTransactionOperations = {
    doOperations: IOperation[],
    undoOperations: IOperation[],
};

/** 用途：限定空段落可转换的目标块类型。使用场景：快捷键将空段落转为结构块。关联类型：由空段落转换器映射到 Lute 节点。 */
export type TEmptyParagraphTarget = "code" | "table" | "line" | "math";

/** 用途：承载引述转换叠加的更新和撤销上下文。使用场景：输入标记转换。关联类型：追加到统一事务操作。 */
export type TBlockquoteUpdateOptions = {
    oldHTML: string,
    undoContext?: Record<string, string>,
    additionalOperations?: TAdditionalTransactionOperations,
};

/** 用途：描述递归列表转换命令。使用场景：列表菜单取消嵌套或变更列表子类型。关联类型：由列表转换器区分目标 Lute 操作。 */
export type TRecursiveListConversion = {
    type: "CancelListRecursively",
} | {
    type: "ConvertListType",
    targetListType: "u" | "o" | "t",
};
