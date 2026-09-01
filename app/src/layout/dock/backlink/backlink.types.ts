/** 用途：模型完整公共根。使用范围：Backlink 领域生命周期。解耦评估：不加载 Model 实现。 */
/** 用途：模型完整公共根。使用范围：Backlink 领域生命周期。解耦评估：不加载 Model 实现。 */
import type {ILayoutModelHost, ModelDomain} from "../../lifecycle/model.types";
import {hasLayoutModelBrand} from "../../lifecycle/modelBrand.guard";
/** 用途：Tree 完整领域根。使用范围：Backlink 的两棵链接树。解耦评估：不加载 Tree 实现。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：Protyle 完整领域根。使用范围：Backlink 内嵌编辑器集合。解耦评估：不加载 Protyle 实现。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 对外复用嵌套完整领域根，具体 Backlink class 的公开字段不得泄露实现类型。 */
export type {ProtyleDomain, TreeDomain};

/** Backlink 的三种宿主展示形态。领域状态不依赖工具栏路由实现。 */
export const BACKLINK_PRESENTATIONS = ["pin", "local", "bottom"] as const;
export type BacklinkPresentation = typeof BACKLINK_PRESENTATIONS[number];
export type BacklinkUserTrigger = "click" | "keyboard" | "ctrl-click" | "alt-click" | "shift-click";

/** Backlink 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const backlinkModelBrand = Symbol("BacklinkModel");

/** 单个文档的反链面板完整可恢复状态。 */
export interface BacklinkStatusItem {
    sort: number;
    mSort: number;
    scrollTop: number;
    mScrollTop: number;
    backlinkOpenIds: string[];
    backlinkMOpenIds: string[];
    backlinkMStatus: number;
    backlinkFolded?: boolean;
    backmentionFolded?: boolean;
}

/** 反链接口响应的完整渲染数据。 */
export interface BacklinkRenderData {
    box: string;
    backlinks: IBlockTree[];
    backmentions: IBlockTree[];
    linkRefsCount: number;
    mentionsCount: number;
    k: string;
    mk: string;
}

/** Backlink class 的完整公共领域表面。 */
export interface BacklinkDomain<
    TApplication extends object = object,
    TParent extends ILayoutModelHost = ILayoutModelHost,
> extends ModelDomain<TApplication, TParent> {
    readonly [backlinkModelBrand]: "Backlink";
    parent?: TParent;
    element: HTMLElement;
    inputsElement: NodeListOf<HTMLInputElement>;
    type: BacklinkPresentation;
    blockId: string;
    rootId: string;
    ownerProtyle?: ProtyleDomain["protyle"];
    tree: TreeDomain;
    mTree: TreeDomain;
    editors: ProtyleDomain[];
    status: Record<string, BacklinkStatusItem>;
    refresh(): void;
    saveStatus(): void;
    render(data: BacklinkRenderData | undefined): void;
    markDirty(): void;
    refreshIfVisible(): void;
    refreshDirty(): void;
    switchBlock(blockId: string, rootId: string, notebookId: string): void;
    executeKeyboardToolbarAction(action: "expand" | "collapse"): void;
    activateTreeItem(item: HTMLElement, trigger: BacklinkUserTrigger): void;
    toggleTreeItem(item: HTMLElement, trigger: BacklinkUserTrigger): void;
    reportKeyboardTreeNavigation(item: HTMLElement): void;
    destroy(): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 BacklinkDomain。
 */
export const isBacklinkDomain = (model: object | undefined): model is BacklinkDomain =>
    hasLayoutModelBrand(model, backlinkModelBrand, "Backlink");
