/** 表示编辑器提交给 Agent 的文本、块 HTML 与块引用快照。 */
export interface ComposerSendData {
    text: string;
    blockHTML: string;
    references: Array<{id: string; title: string}>;
}

/** Composer 中一个可插入块引用的稳定标识与显示文本。 */
export interface AgentComposerMention {
    id: string;
    label: string;
}

/** Composer 块拖放流程的宿主、解析器、写入器和错误出口。 */
export interface AgentComposerBlockDropOptions {
    host: HTMLElement;
    resolveLabel: (id: string) => Promise<string>;
    insertMentions: (mentions: AgentComposerMention[]) => void;
    reportError: (error: unknown) => void;
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
    insertMentions: (mentions: AgentComposerMention[]) => void;
    renderBlockHTML: (element: HTMLElement, onRender: () => void) => void;
}

/** 表示编辑器内容变化后的轻量通知，由聊天面板更新发送按钮状态。 */
export type ComposerChangeCallback = () => void;
