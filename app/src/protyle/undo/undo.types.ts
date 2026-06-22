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

/**
 * 撤销/重做状态本地镜像。
 *
 * @description
 * 缓存指定文档（rootID）的当前撤销/重做可用状态，避免频繁调用 kernel API 查询。
 * - 在编辑操作（add 落点）、撤销/重做响应、WebSocket 广播（context.undoState）时更新。
 * - undoStateMirror（Map<string, IUndoStateMirror>）是全局 Map，以 rootID 为键。
 *
 * @usage
 * - {@link markMirror}：写入或合并更新镜像
 * - {@link getMirror}：读取镜像；不存在时返回 {canUndo: false, canRedo: false}
 * - {@link syncMirrorFromBroadcast}：从 WS 广播批量更新
 * - {@link initMirror}：文档打开时初始化
 * - {@link refreshUndoButtons}：读镜像刷新按钮 disabled 状态（零 fetch）
 *
 * @关联类型 配合 globalUndo.ts 中的 undoStateMirror（Map<string, IUndoStateMirror>）使用
 *           仅用于前端按钮态同步，不参与 kernel 撤销栈逻辑
 *
 * @see globalUndo.ts undoStateMirror 常量
 */
export interface IUndoStateMirror {
    /** 当前文档是否有可撤销操作 */
    canUndo: boolean;
    /** 当前文档是否有可重做操作 */
    canRedo: boolean;
}
