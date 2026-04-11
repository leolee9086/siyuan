/**
 * Files 组件类型定义
 * @module eventHandlers.types
 */

import type { App } from "../../../index";
import type { Files } from "../Files";

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
 * 事件处理器所需的上下文
 * 包含 Files 实例和 App 实例的引用
 */
export interface FilesEventContext {
    /** Files 组件实例 */
    files: Files;
    /** 应用实例 */
    app: App;
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
