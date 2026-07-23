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
    pushHistory: (text: string) => void;
    getHistory: () => string[];
    clearHistory: () => void;
    restoreHistory: (history: string[]) => void;
    insertMention: (id: string, label: string) => void;
    insertMentions: (mentions: Array<{id: string; label: string}>) => void;
    renderBlockHTML: (element: HTMLElement, onRender: () => void) => void;
}

export type ComposerChangeCallback = () => void;
