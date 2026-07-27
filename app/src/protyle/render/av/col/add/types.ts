/** 用途：复用 AV 菜单面板完整领域外观；使用范围：添加列菜单和呈现参数；解耦评估：纯类型依赖直达声明源，不加载具体面板实现。 */
import type {AVMenuPanelDomain} from "../../openMenuPanel.types";
/** 导出完整 AV 菜单面板领域外观，供添加列调用链参数化复用。 */
export type {AVMenuPanelDomain};

/** 创建添加列菜单所需的完整公开参数。 */
export interface AddColumnMenuOptions {
    protyle: IProtyle;
    blockElement: Element;
    panel: AVMenuPanelDomain;
    previousID?: string | undefined;
}

/** 添加列菜单项共享的完整内部上下文。 */
export interface AddColumnMenuContext extends AddColumnMenuOptions {
    avID: string;
    blockId: string;
    previousID: string | undefined;
}

/** 列添加 DOM 呈现及添加后编辑导航的完整参数。 */
export interface AddColumnPresentationOptions {
    blockElement: Element;
    protyle: IProtyle;
    panel: AVMenuPanelDomain;
    type: TAVCol;
    name: string;
    id: string;
    icon?: string;
    previousID: string | undefined;
    data?: IAV;
}
