import { Dialog } from "../../dialog";

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
    dialog: Dialog;
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
