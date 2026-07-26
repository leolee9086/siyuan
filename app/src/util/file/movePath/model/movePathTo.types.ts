/** 用途：描述移动路径流程使用的对话框生命周期与根元素；使用范围：仅限移动路径事件上下文；解耦评估：依赖 Dialog 领域契约，由创建方传入实例，不依赖具体构造和布局实现。 */
import type {IDialog} from "./imports";

/** 点击事件处理器的上下文类型 */
export type ClickHandlerContext = {
    searchListElement: HTMLElement;
    searchTreeElement: HTMLElement;
    toggleMovePathHistory: () => void;
    options: {
        flashcard: boolean;
        title?: string;
        cb: (toPath: string[], toNotebook: string[]) => void;
    };
    dialog: IDialog;
    inputElement: HTMLInputElement;
};

/**
 * 移动路径对话框的选项配置接口
 * 用于传递移动/复制操作所需的参数和上下文信息
 */
export interface MovePathToOptions {
    cb: (toPath: string[], toNotebook: string[]) => void;
    paths?: string[];
    range?: Range;
    title?: string;
    flashcard: boolean;
    rootIDs?: string[];
}

/**
 * 笔记本数据项接口
 */
export interface NotebookItem {
    id: string;
    name: string;
    icon: string;
    closed: boolean;
    newFlashcardCount?: string;
    dueFlashcardCount?: string;
    flashcardCount?: string;
}

/**
 * 搜索结果项数据接口
 */
export interface SearchResultItem {
    boxIcon: string;
    box: string;
    hPath: string;
    path: string;
    newFlashcardCount: string;
    dueFlashcardCount: string;
    flashcardCount: string;
}
