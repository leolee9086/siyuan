/** WYSIWYG 编辑区的稳定运行时身份，子模块无需加载具体 class。 */
export const wysiwygBrand = Symbol("WYSIWYG");

/** WYSIWYG class 的完整公共领域表面。 */
export interface WYSIWYGDomain {
    readonly [wysiwygBrand]: "WYSIWYG";
    lastHTMLs: { [key: string]: string };
    element: HTMLDivElement;
    preventKeyup: boolean;
    renderCustom(ial: Record<string, string>): void;
    flushPendingInput(): void;
    withInputSuppressed<T>(callback: () => T): T;
    destroy(): void;
    copyRichText(): void;
    prepareLargeListVirtualization(contentElement: Element, replace: boolean): void;
    readonly tableControl?: { destroy(): void };
}
