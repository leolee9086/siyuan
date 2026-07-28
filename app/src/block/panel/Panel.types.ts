/** BlockPanel 的完整公开领域表面；依赖方只使用此聚合根类型。 */
import type {AppFacade} from "../../app/AppFacade.types";
import type {ProtyleDomain} from "../../protyle/protyle.types";

export interface BlockPanelDomain {
    element: HTMLElement | undefined;
    contentElement: HTMLElement | undefined;
    targetElement: HTMLElement | undefined;
    refDefs: IRefDefs[];
    id: string;
    app: AppFacade;
    x: number | undefined;
    y: number | undefined;
    isBacklink: boolean;
    editors: ProtyleDomain[];
    observerResize: ResizeObserver | undefined;
    observerLoad: IntersectionObserver | undefined;
    originalRefBlockIDs: IObject | undefined;
    destroy(): void;
    isDestroyed(): boolean;
}
