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
    /** 命中块的节点类型；属性视图块走数据库直达打开流程。 */
    nodeType?: string | undefined;
    /** 当前搜索方法；决定属性视图目标解析是否生效。 */
    method?: number | undefined;
    /** 列表项关键词；供属性视图目标解析定位匹配行。 */
    keywords?: string[] | undefined;
}
