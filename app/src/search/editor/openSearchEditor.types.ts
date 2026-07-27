/**
 * 打开搜索结果编辑器的完整操作参数。
 * 搜索列表点击与键盘导航共同使用该数据对象；其中 Protyle 提供当前范围和 AppFacade 导航能力。
 */
export interface OpenSearchEditorOptions {
    protyle: IProtyle;
    openPosition?: "right" | "bottom" | undefined;
    id: string;
    rootId: string;
    cb?: (() => void) | undefined;
}
