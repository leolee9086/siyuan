/**
 * 用途：描述一次折叠状态变更的完整输入。
 * 使用场景：DOM 状态应用与可逆操作构造共享同一请求快照。
 * 关联类型：`IProtyle` 提供编辑器上下文，`IOperation` 由此输入派生。
 * 问题/改进：若未来折叠策略增加显式模式，可在此对象中扩展而不增加函数位置参数。
 */
export interface FoldStateRequest {
    protyle: IProtyle;
    nodeElement: Element;
    isRemove?: boolean;
    addLoading: boolean;
    isOpen?: boolean;
}

/**
 * 用途：描述操作快照构造所需的已解析折叠状态。
 * 使用场景：标题与普通块的可逆操作生成。
 * 关联类型：在 `FoldStateRequest` 基础上补充块标识与变更前状态。
 * 问题/改进：仅限折叠状态模块内部使用，不作为跨领域契约扩散。
 */
export interface FoldOperationOptions extends FoldStateRequest {
    id: string;
    hasFold: boolean;
}
