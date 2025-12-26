/** 搜索上下文参数 */
export interface SearchContext {
    protyle: IProtyle;
    item: HTMLElement;
    content: string;
    breadcrumb: boolean;
    top?: number | undefined;
}

/** 语义搜索结果项 */
export interface SemanticSearchResultItem {
    blockId: string;
    content?: string;
    hpath?: string;
    type?: string;
    box?: string;
    rootID?: string;
    name?: string;
    alias?: string;
    memo?: string;
    tag?: string;
    ial?: string;
    score: number;
}
