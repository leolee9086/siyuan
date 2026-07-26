/** Hint 提示面板的稳定身份，子模块无需加载具体 class。 */
export const hintBrand = Symbol("Hint");

/** Hint class 的完整公共领域表面。 */
export interface HintDomain {
    readonly [hintBrand]: "Hint";
    timeId: number;
    element: HTMLDivElement;
    enableSlash: boolean;
    enableEmoji: boolean;
    enableExtend: boolean;
    splitChar: string;
    lastIndex: number;
    source: THintSource;
    multiRefMode: boolean;
    selectedRefIds: Set<string> | undefined;
    render(protyle: IProtyle): void;
    genLoading(protyle: IProtyle): void;
    bindUploadEvent(protyle: IProtyle, element: HTMLElement): void;
    genHTML(data: IHintData[], protyle: IProtyle, hide: boolean | undefined, source: THintSource): void;
    fill(value: string, protyle: IProtyle, updateRange?: boolean, refIsS?: boolean): void;
    select(event: KeyboardEvent, protyle: IProtyle): boolean;
}
