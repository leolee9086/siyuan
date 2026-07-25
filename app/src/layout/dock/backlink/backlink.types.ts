/** 用途：模型完整公共根。使用范围：Backlink 领域生命周期。解耦评估：不加载 Model 实现。 */
import type {ILayoutModelHost} from "../../lifecycle/model.types";
/** 用途：模型完整公共根。使用范围：Backlink 领域生命周期。解耦评估：不加载 Model 实现。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：Tree 完整领域根。使用范围：Backlink 的两棵链接树。解耦评估：不加载 Tree 实现。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：Protyle 完整领域根。使用范围：Backlink 内嵌编辑器集合。解耦评估：不加载 Protyle 实现。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 对外复用嵌套完整领域根，具体 Backlink class 的公开字段不得泄露实现类型。 */
export type {ProtyleDomain, TreeDomain};

/** 单个文档的反链面板完整可恢复状态。 */
export interface BacklinkStatusItem {
    sort: number;
    mSort: number;
    scrollTop: number;
    mScrollTop: number;
    backlinkOpenIds: string[];
    backlinkMOpenIds: string[];
    backlinkMStatus: number;
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
    element: HTMLElement;
    inputsElement: NodeListOf<HTMLInputElement>;
    type: "pin" | "local";
    blockId: string;
    rootId: string;
    tree: TreeDomain;
    mTree: TreeDomain;
    editors: ProtyleDomain[];
    status: Record<string, BacklinkStatusItem>;
    refresh(): void;
    saveStatus(): void;
    render(data: BacklinkRenderData | undefined): void;
}
