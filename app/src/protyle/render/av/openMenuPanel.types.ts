/** AV 菜单面板完整运行时外观的稳定厂牌。 */
export const avMenuPanelDomainBrand: unique symbol = Symbol("AVMenuPanelDomain");

/** 打开 AV 视图标题菜单所需的完整参数。 */
export interface OpenAVViewMenuOptions {
    protyle: IProtyle;
    blockElement: HTMLElement;
    element: HTMLElement;
}

/** 打开任一 AV 菜单面板所需的完整参数。 */
export interface OpenAVMenuPanelOptions {
    protyle: IProtyle;
    blockElement: Element;
    type: "select" | "properties" | "config" | "sorts" | "filters" | "edit" | "date" | "asset" | "switcher" | "relation" | "rollup";
    colId?: string;
    editData?: {
        previousID: string | undefined;
        colData: IAVColumn;
    };
    cellElements?: HTMLElement[];
    data?: IAV;
    cb?: (avPanelElement: Element) => void;
}

/**
 * AV 菜单面板的完整公共领域外观。
 * 覆盖通用 Panel 与视图标题 Menu 两个现有公开入口，供下层列添加导航依赖抽象而非具体组合模块。
 */
export interface AVMenuPanelDomain {
    readonly [avMenuPanelDomainBrand]: "AVMenuPanelDomain";
    readonly open: (options: OpenAVMenuPanelOptions) => void;
    readonly openViewMenu: (options: OpenAVViewMenuOptions) => void;
}

/**
 * openMenuPanel 拆分后各子模块共享的完整运行上下文。
 * 聚合同一面板实例的数据、字段、DOM、定位、关闭和领域外观，不为单个点击分支裁剪能力。
 */
export interface IMenuPanelContext {
    options: OpenAVMenuPanelOptions;
    panel: AVMenuPanelDomain;
    data: IAV;
    fields: IAVColumn[];
    avID: string;
    blockID: string;
    isCustomAttr: boolean;
    menuElement: HTMLElement;
    avPanelElement: HTMLElement;
    tabRect: DOMRect;
    closeCB?: () => void;
}
