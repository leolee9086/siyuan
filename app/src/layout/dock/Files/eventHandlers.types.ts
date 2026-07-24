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
) => Promise<HTMLElement | undefined>;

// ============================================================================
// 事件处理器相关类型
// ============================================================================

/**
 * 用途：表示文件树事件域所需的完整组件状态与行为。
 * 使用场景：工具栏、关闭区、鼠标选择和文件打开事件共享同一宿主。
 * 关联类型：Files class 以结构化类型实现该契约，不包含应用宿主身份。
 */
export interface FilesEventHost {
    readonly element: HTMLElement;
    readonly actionsElement: HTMLElement;
    readonly closeElement: HTMLElement;
    lastSelectedElement: Element | null;
    init: (isInitialCall?: boolean) => void;
    refreshPublishAccessSwitch: () => void;
    updateDocActions: () => void;
    setCurrent: (target: HTMLElement, isScroll?: boolean) => void;
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void;
}

/**
 * 用途：组合文件树事件宿主与应用身份。
 * 使用场景：事件聚合入口将同一上下文交给各类事件处理器。
 * 关联类型：文件树能力固定为 FilesEventHost，TApplication 由主应用实现绑定。
 */
export interface FilesEventContext<TApplication> {
    files: FilesEventHost;
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
