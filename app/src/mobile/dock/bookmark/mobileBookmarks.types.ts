/** MobileBookmarks 的稳定运行时身份；消费方无需加载具体 class。 */
export const mobileBookmarksBrand = Symbol("MobileBookmarks");

/** MobileBookmarks class 的完整公共领域表面。 */
export interface MobileBookmarksDomain {
    readonly [mobileBookmarksBrand]: "MobileBookmarks";
    element: HTMLElement;
    update(): void;
}
