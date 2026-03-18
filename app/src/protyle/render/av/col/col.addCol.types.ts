/**
 * addCol 辅助模块的类型定义。
 *
 * 用途：为 col.addCol.ts 中的 addColMenuItems 函数提供上下文参数类型。
 * 使用场景：addCol 函数将闭包变量打包为此上下文对象，传递给辅助函数。
 * 关联类型：IProtyle（编辑器实例）
 */
export interface IAddColContext {
    protyle: IProtyle;
    blockElement: Element;
    avID: string | null;
    previousID: string | undefined;
    blockId: string | null;
}
