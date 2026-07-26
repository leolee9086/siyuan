/** Background 题头领域的稳定身份，子模块无需加载具体 class。 */
export const backgroundBrand = Symbol("Background");

/** Background class 的完整公共领域表面。 */
export interface BackgroundDomain {
    readonly [backgroundBrand]: "Background";
    element: HTMLElement;
    ial: IObject;
    imgElement: HTMLImageElement;
    iconElement: HTMLElement;
    actionElements: NodeListOf<Element>;
    tagsElement: HTMLElement;
    transparentData: string;
    dragOccurred: boolean;
    render(ial: IObject, rootId: string): void;
}
