/**
 * @fileoverview WebSocket消息回调处理器类型定义
 */

import { App } from "../../../index";

/**
 * 消息处理上下文接口
 *
 * @description
 * 作用：定义消息处理函数所需的上下文信息
 * 意图：将Files实例的必要属性和方法传递给处理函数，避免在非类方法中使用this
 */
export interface MsgCallbackContext {
    /** 文件树的根元素 */
    element: HTMLElement;
    /** 已关闭笔记本的容器元素 */
    closeElement: HTMLElement;
    /** 应用实例 */
    app: App;
    /** 生成笔记本HTML的方法 */
    genNotebook: (item: INotebook) => string;
    /** 生成文档aria-label的方法 */
    genDocAriaLabel: (item: IFile, escapeMethod: (text: string) => string) => string;
    /** 选择文件项的方法 */
    selectItem: (notebookId: string, filePath: string) => Promise<HTMLElement | undefined>;
    /** 更新文件项箭头的方法 */
    updateItemArrow: (notebookId: string, filePath: string) => void;
    /** 获取子文档列表的方法 */
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void;
    /** 重命名处理方法 */
    onRename: (data: { path: string; title: string; box: string }) => void;
    /** 初始化方法 */
    init: (init?: boolean) => void;
    /** 更新文档信息方法 */
    updateDocInfo: (data: IWebSocketData) => void;
    /** 移动文档处理方法 */
    onMove: (data: IWebSocketData) => void;
    /** 挂载笔记本处理方法 */
    onMount: (data: { data: { box: INotebook; existed?: boolean }; callback?: string }) => void;
    /** 移除处理方法 */
    onRemove: (data: IWebSocketData) => void;
}
