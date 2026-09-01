/** 表示编辑器提交给 Agent 的文本、块 HTML 与块引用快照。 */
export interface ComposerSendData {
    text: string;
    blockHTML: string;
    references: Array<{id: string; title: string}>;
}

/** 上游协议别名：编辑器提交给 Agent 的发送快照，与 ComposerSendData 完全同构。 */
export type AgentComposerData = ComposerSendData;

/**
 * 表示挂载 Composer 时可传入的上游编辑态选项；两种后端共享同一契约。
 * 可选属性显式联合 undefined，以兼容 exactOptionalPropertyTypes 下的整包透传。
 */
export interface AgentComposerOptions {
    /** 恢复编辑时的 Markdown 草稿；优先级低于 initialBlockHTML。 */
    initialContent?: string | undefined;
    /** 恢复编辑时的块 DOM 快照；Protyle 直接还原结构，Tiptap 以 HTML 内容注入。 */
    initialBlockHTML?: string | undefined;
    /** 覆盖默认的 Agent 输入占位文案（如移动端短占位）。 */
    placeholder?: string | undefined;
    /** Escape 触发的取消回调（如退出用户消息编辑并恢复原文）。 */
    onCancel?: (() => void) | undefined;
    /** 关闭 ↑↓ 已发送消息翻阅历史；编辑态等场景显式传 false。 */
    enableHistory?: boolean | undefined;
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
    /** 聚焦编辑器；toEnd 为 true 时把光标移到内容末尾（上游移动端协议）。 */
    focus: (toEnd?: boolean) => void;
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
