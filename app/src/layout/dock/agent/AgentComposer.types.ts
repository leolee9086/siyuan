/** 表示编辑器提交给 Agent 的文本、块 HTML 与块引用快照。 */
export interface ComposerSendData {
    text: string;
    blockHTML: string;
    references: Array<{id: string; title: string}>;
}

/** 两种编辑器运行时共同实现的 Agent 输入契约。 */
export interface ComposerHandle {
    focus: () => void;
    destroy: () => void;
    getSendData: () => ComposerSendData;
    clear: () => void;
    setText: (text: string) => void;
    insertText: (text: string) => void;
    pushHistory: (text: string) => void;
    getHistory: () => string[];
    clearHistory: () => void;
    restoreHistory: (history: string[]) => void;
    insertMention: (id: string, label: string) => void;
    insertMentions: (mentions: Array<{id: string; label: string}>) => void;
    renderBlockHTML: (element: HTMLElement, onRender: () => void) => void;
}

/** 表示编辑器内容变化后的轻量通知，由聊天面板更新发送按钮状态。 */
export type ComposerChangeCallback = () => void;
