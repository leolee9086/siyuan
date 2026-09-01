/** 用途：复用 Agent 请求上下文和工具效果结构；使用范围：会话条目判别联合；解耦评估：纯类型依赖，不加载 SSE 实现。 */
import type {IEditorContext} from "../../request/sse/agentSSE.types";
/** 用途：约束确认与持久化工具影响；使用范围：会话条目聚合；解耦评估：同一 Agent 请求领域的纯数据类型。 */
import type {IToolEffects} from "../../request/sse/agentSSE.types";

/** 所有可持久化消息条目共享的可选标识。 */
export type EntryBase = {id?: string};
/** 用户消息正文中引用的块标识和显示标题。 */
export type AgentReference = {id: string; title: string};
/** 创建或追加用户消息时可提供的持久化展示字段。 */
export type UserMessageOptions = {
    timestamp?: number;
    entryId?: string;
    blockHTML?: string;
};
/** 可编辑用户消息的完整运行时条目。 */
export type UserEntry = EntryBase & {
    type: "user";
    content: string;
    blockHTML?: string;
    references?: AgentReference[];
    editorContext?: IEditorContext;
    timestamp?: number;
};

/** 只读用户消息动作区在复制、编辑按钮和正文点击间共享的完整上下文。 */
export interface UserMessageActionContext {
    element: HTMLElement;
    body: HTMLElement;
    text: string;
    timestamp?: number;
    entryID?: string;
}

/** 用户消息编辑期间由取消、提交和键盘处理共同持有的完整上下文。 */
export interface UserEditBindingContext {
    entryID: string;
    entry: UserEntry;
    element: HTMLElement;
    controls: {
        textarea: HTMLTextAreaElement;
        cancel: HTMLButtonElement;
        submit: HTMLButtonElement;
    };
}

/** 一次思考过程中的推理、工具和可选正文快照。 */
export type ThinkingStep = {
    reasoning: string;
    reasoningContent: string;
    roundID?: string;
    toolNames?: string[];
    toolCallIDs?: string[];
    content?: string;
    text?: string;
    toolCalls?: Array<{name: string; result?: string}>;
};

/** Agent 调用一个工具时保存的参数、状态和可选结果。 */
export type AgentToolCall = {
    id?: string;
    name: string;
    roundID?: string;
    arguments: Record<string, unknown>;
    argumentsJSON?: string;
    result?: string;
    state?: string;
    providerData?: {
        google?: {
            thoughtSignature?: string;
        };
    };
};

/** 会话中所有可持久化消息与交互记录的判别联合。 */
export type SessionEntry =
    | UserEntry
    | (EntryBase & {
    type: "thinking";
    steps: ThinkingStep[];
    duration?: number;
    roundID?: string;
})
    | (EntryBase & {
    type: "assistant";
    content?: string;
    reasoningContent?: string;
    responseOutput?: Array<Record<string, unknown>>;
    responseOutputTokens?: number;
    roundID?: string;
    toolCalls?: AgentToolCall[];
    timestamp?: number;
})
    | (EntryBase & {
    type: "confirm";
    name: string;
    args: Record<string, unknown>;
    confirmID: string;
    effects?: IToolEffects;
    status?: string;
    roundID?: string;
})
    | (EntryBase & {
    type: "question";
    questionID: string;
    questions: Array<Record<string, unknown>>;
    status?: string;
    answers?: string[];
    roundID?: string;
})
    | (EntryBase & { type: "todo"; result: string; callID?: string; roundID?: string })
    | (EntryBase & { type: "snapshot"; snapshotID: string; roundID?: string })
    | (EntryBase & { type: "rollback"; snapshotID: string; roundID?: string });
