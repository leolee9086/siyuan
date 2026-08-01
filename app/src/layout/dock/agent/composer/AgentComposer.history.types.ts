/** 聚合 Composer 历史条目、浏览位置和进入浏览前的草稿，字段公开供测试和宿主观察。 */
export interface ComposerHistoryState {
    items: string[];
    index: number;
    savedDraft: string;
}
