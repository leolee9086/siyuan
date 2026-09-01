/**
 * WebSocket 消息回调处理模块类型定义
 *
 * @description
 * 作用：定义消息回调处理所需的接口和类型
 * 意图：将类型定义从业务逻辑中分离，符合架构约束
 */

/**
 * Files 实例的依赖接口
 *
 * @description
 * 作用：定义处理消息回调所需的 Files 实例方法和属性
 * 意图：使用接口解耦，便于测试和维护
 */
export interface IFilesContext {
    element: HTMLElement;
    closeElement: HTMLElement;
    init: (mount: boolean) => void;
    selectItem: (notebookId: string, filePath: string) => Promise<HTMLElement | null | undefined>;
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void;
    onRename: (data: { box: string; path: string; title: string; }) => void;
    reloadNotebookInfo: () => void;
    recordMovedExpandedDocIDs: (ids: Iterable<string>) => void;
    restoreMovedExpandedItems: (listElement: Element, notebookId: string) => void;
    updateDocActionElement: (liElement: HTMLElement) => void;
    persistOpenPaths: () => void;
}
