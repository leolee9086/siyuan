/**
 * 用途：提供 Outline 所在页签的布局领域根契约。
 * 使用范围：Outline 抽象契约及其拆分后的树、筛选、消息处理模块；具体 Tab/Wnd 只在组合与校验边界出现。
 * 解耦评估：该类型描述稳定的布局关系，应由 layout 公共类型根统一定义；这样可避免在 Outline 内复制 Window/Tab 局部接口。
 */
import type {LayoutTab} from "../../layout.types";
/** 用途：完整 Outline 默认宿主身份。使用范围：Outline 组合根及其公共领域契约。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：模型完整公共根。使用范围：Outline 生命周期。解耦评估：不加载 Model class。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：Tree 完整领域根。使用范围：Outline 树状态和行为。解耦评估：不加载 Tree class。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：完整 Protyle 领域根。使用范围：Outline 编辑上下文将事务交还编辑器所有者。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 对外复用 Outline 的完整树领域身份。 */
export type {TreeDomain};

/** Outline 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const outlineModelBrand = Symbol("OutlineModel");

/**
 * 拖拽状态类型定义
 * @property item 被拖拽的元素
 * @property outline Outline 实例
 * @property editor 关联的编辑器实例
 * @property ghostElement 拖拽时的幽灵元素
 * @property selectItem 当前悬停的目标元素
 * @property contentRect 容器矩形信息
 * @property startX 拖拽起始 X 坐标
 * @property startY 拖拽起始 Y 坐标
 */
export type DragState = {
    item: HTMLElement;
    outline: OutlineDomain;
    editor?: IProtyle;
    ghostElement?: HTMLElement;
    selectItem?: HTMLElement;
    contentRect: DOMRect;
    startX: number;
    startY: number;
};

/** Outline 构造及头部事件初始化共享的完整宿主参数。 */
export interface OutlineOptions<TApplication extends object = AppFacade> {
    app: TApplication;
    tab: LayoutTab;
    blockId: string;
    type: "pin" | "local";
    isPreview: boolean;
}

/** Outline 操作解析出的编辑器与标题块。 */
export interface OutlineEditorContext {
    editor: ProtyleDomain;
    protyle: IProtyle;
    blockElement: HTMLElement;
}

/**
 * Outline 树交互领域根。
 *
 * 筛选、高亮、层级展开和右键树动作共享这一状态所有者；应用、页签、编辑器和网络身份不属于该领域。
 */
export interface OutlineDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [outlineModelBrand]: "Outline";
    element: HTMLElement;
    headerElement: HTMLElement;
    tree: TreeDomain;
    preFilterExpandIds: string[] | null;
    blockId: string;
    type: "pin" | "local";
    isPreview: boolean;
    bindSort: () => void;
    setFilter: () => void;
    expandToLevel: (targetLevel: number) => void;
    saveExpendIds: () => void;
    collapseChildren: (element: HTMLElement, expand?: boolean) => void;
    collapseSameLevel: (element: HTMLElement, expand?: boolean) => void;
    setCurrent: (nodeElement: HTMLElement) => void;
    setCurrentByPreview: (nodeElement: Element) => void;
    setCurrentById: (id: string) => void;
    showExpandLevelMenu: (target: HTMLElement) => void;
    showContextMenu: (element: HTMLElement, event: MouseEvent) => void;
    minimize: () => void | undefined;
    update: (data: IWebSocketData, callbackId?: string) => void;
    updateDocTitle: (ial?: IObject, count?: number) => void;
    genHeadingTransform: (outline: OutlineDomain, id: string, level: number) => IMenu;
    getProtyleAndBlockElement: (node: Node) => OutlineEditorContext | undefined;
    initHeaderEvents: (outline: OutlineDomain, options: OutlineOptions<TApplication>) => void;
    onModelCallback(): void;
    onModelMsgCallback(data: IWebSocketData): void;
    reload(blockId?: string): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 OutlineDomain。
 */
export const isOutlineDomain = (model: object): model is OutlineDomain =>
    outlineModelBrand in model && model[outlineModelBrand] === "Outline";
