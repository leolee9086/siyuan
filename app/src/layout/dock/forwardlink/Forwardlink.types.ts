/** 用途：模型完整公共根。使用范围：Forwardlink 领域生命周期。解耦评估：不加载 Model 实现。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：布局页签完整领域根。使用范围：Forwardlink 宿主生命周期。解耦评估：不加载 Tab 实现。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：应用完整抽象外观。使用范围：Forwardlink 调用编辑器与宿主能力。解耦评估：不加载 App 实现。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：Tree 完整领域根。使用范围：Forwardlink 链接树。解耦评估：不加载 Tree 实现。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：Protyle 完整领域根。使用范围：Forwardlink 内嵌编辑器集合。解耦评估：不加载 Protyle 实现。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 对外复用嵌套完整领域根，具体 Forwardlink class 的公开字段不得泄露实现类型。 */
export type {ProtyleDomain, TreeDomain};

/** Forwardlink 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const forwardlinkModelBrand = Symbol("ForwardlinkModel");

/**
 * 正向链接树节点数据
 * 
 * - 用途：表示正向链接面板树状结构中的单个节点
 * - 使用场景：Tree 组件渲染、节点展开/折叠操作
 * - 关联类型：由 ISqlResultItem 转换而来
 */
export interface IForwardlinkTreeNode {
    id: string;
    name: string;
    type: string;
    subType?: string;
    box: string;
    hPath: string;
    count: number;
    children?: IForwardlinkTreeNode[];
    ial?: { [key: string]: string };
    icon?: string;
}

/**
 * 单个正向链接面板状态项
 * 
 * - 用途：保存某个文档对应的正向链接面板 UI 状态
 * - 使用场景：用户切换文档时恢复之前的展开/折叠和滚动状态
 * - 关联类型：作为 IForwardlinkStatus 的值类型
 */
export interface IForwardlinkStatusItem {
    sort: number;
    scrollTop: number;
    forwardlinkOpenIds: string[];
}

/**
 * 正向链接面板状态字典
 * - 用途：以 rootId 为键存储多个文档的面板状态
 * - 使用场景：在 Forwardlink 组件中持久化和恢复 UI 状态
 * - 关联类型：值为 IForwardlinkStatusItem
 */
export interface IForwardlinkStatus {
    [key: string]: IForwardlinkStatusItem;
}

/**
 * SQL 查询返回的正向链接原始数据项
 * 
 * - 用途：表示从数据库查询返回的单条正向链接记录
 * - 使用场景：searchForwardLinks 函数内部处理 SQL 查询结果时使用
 * - 关联类型：会被转换为 IForwardlinkTreeNode 供 UI 层使用
 */
export interface ISqlResultItem {
    id: string;
    name: string;
    type: string;
    box: string;
    hPath: string;
    ial: string;
    refCount: number;
}

/**
 * 块查询结果项
 * 
 * - 用途：表示从数据库查询返回的单个块信息
 * - 使用场景：fetchBlocks 函数返回的块列表中的每个元素
 * - 关联类型：由 UI 层渲染为列表项
 */
export interface IBlockResult {
    id: string;
    content: string;
    type: string;
    subType: string;
    box: string;
}

/** Forwardlink 接口响应的完整渲染数据。 */
export interface ForwardlinkRenderData {
    forwardlinks: IForwardlinkTreeNode[];
    count: number;
}

/** Forwardlink class 的完整公共领域表面。 */
export interface ForwardlinkDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [forwardlinkModelBrand]: "Forwardlink";
    element: HTMLElement;
    inputsElement: NodeListOf<HTMLInputElement>;
    type: "pin" | "local";
    blockId: string;
    rootId: string;
    notebookId: string;
    tree: TreeDomain;
    editors: ProtyleDomain[];
    status: IForwardlinkStatus;
    refresh(): void;
    保存状态(): void;
    渲染数据(data: ForwardlinkRenderData): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 ForwardlinkDomain。
 */
export const isForwardlinkDomain = (model: object): model is ForwardlinkDomain =>
    forwardlinkModelBrand in model && model[forwardlinkModelBrand] === "Forwardlink";
