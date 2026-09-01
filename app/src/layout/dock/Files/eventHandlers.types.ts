/** 用途：布局页签完整领域根。使用范围：Files 模型父宿主。解耦评估：不加载 Tab class。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：模型完整公共根。使用范围：Files 模型生命周期。解耦评估：不加载 Model class。 */
import type {ModelDomain} from "../../lifecycle/model.types";
import {hasLayoutModelBrand} from "../../lifecycle/modelBrand.guard";
/** 对外复用 Files 的完整页签宿主身份。 */
export type {LayoutTab};

/** Files 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const filesModelBrand = Symbol("FilesModel");

/**
 * Files 组件类型定义
 * @module eventHandlers.types
 */

// ============================================================================
// 初始化相关类型
// ============================================================================

/**
 * 笔记本HTML生成结果
 */
export interface NotebooksHtmlResult {
    /** 打开的笔记本HTML */
    openHtml: string;
    /** 关闭的笔记本HTML */
    closeHtml: string;
    /** 关闭的笔记本数量 */
    closeCounter: number;
}

/**
 * selectItem 函数类型定义
 */
export type SelectItemFn = (
    notebookId: string,
    filePath: string,
    data?: { files: IFile[]; box: string; path: string },
    setStorage?: boolean,
    isSetCurrent?: boolean
) => Promise<HTMLElement | null | undefined>;

/** Files class 的完整公共领域表面。 */
export interface FilesDomain<
    TApplication extends object = object,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [filesModelBrand]: "Files";
    element: HTMLElement;
    parent: TParent;
    closeElement: HTMLElement;
    lastSelectedElement: Element | null;
    actionsElement: HTMLElement;
    init(isInitialCall?: boolean): void;
    setCurrent(target: HTMLElement, isScroll?: boolean): void;
    getLeaf(liElement: Element, notebookId: string, focusUpdate?: boolean): void;
    selectItem: SelectItemFn;
    refreshPublishAccessSwitch(): void;
    updateDocActions(): void;
    onFiletreeSortChanged(data: {notebook: string; parentPath: string}): void;
    onNotebookSortChanged(): void;
    recordMovedExpandedDocIDs(ids: Iterable<string>): void;
    restoreMovedExpandedItems(listElement: Element, notebookId: string): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 FilesDomain。
 */
export const isFilesDomain = (model: object | undefined): model is FilesDomain =>
    hasLayoutModelBrand(model, filesModelBrand, "Files");

// ============================================================================
// 事件处理器相关类型
// ============================================================================

/**
 * 用途：表示文件树事件域所需的完整组件状态与行为。
 * 使用场景：工具栏、关闭区、鼠标选择和文件打开事件共享同一宿主。
 * 关联类型：Files class 以结构化类型实现该契约，不包含应用宿主身份。
 */
/** 用途：组合完整文件树领域根与应用身份。 */
export interface FilesEventContext<TApplication extends object> {
    files: FilesDomain<TApplication>;
    app: TApplication;
}





/**
 * 初始化面板元素引用结果
 */
export interface InitPanelResult {
    /** 工具栏元素 */
    actionsElement: HTMLElement;
    /** 文件树容器元素 */
    element: HTMLElement;
    /** 关闭笔记本区域元素 */
    closeElement: HTMLElement;
}
