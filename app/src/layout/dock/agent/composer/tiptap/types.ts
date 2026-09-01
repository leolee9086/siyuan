/** 用途：描述标准菜单实例；使用范围：Tiptap Composer 显式交互状态。 */
import type {Menu} from "./imports";
/** 用途：描述 Tiptap 编辑器实例；使用范围：键盘分派上下文。 */
import type {Editor} from "./imports";
/** 用途：描述 Composer 历史状态；使用范围：编辑器工厂与键盘分派上下文。 */
import type {ComposerHistoryState} from "../AgentComposer.history.types";
/** 用途：描述 Composer 内容变化回调与上游编辑态选项；使用范围：编辑器工厂选项。 */
import type {AgentComposerOptions, ComposerChangeCallback} from "../AgentComposer.types";

/** 表示 @ 引用或 / 技能建议菜单中的单个条目，由提示源映射为统一结构。 */
export interface BlockHit {
    id: string;
    label: string;
    icon: string;
    hPath: string;
}

/** 聚合标准菜单实例、宿主和当前选择，所有菜单副作用都显式接收此状态。 */
export interface SuggestionMenuState {
    host: HTMLElement;
    menu: Menu;
    open: boolean;
    selectedIndex: number;
    items: BlockHit[];
    command: ((item: BlockHit) => void) | null;
}

/** 聚合 Tiptap Composer 的菜单、Slash 请求与销毁状态，供各处理器显式协作。 */
export interface TiptapComposerInteractionState {
    suggestion: SuggestionMenuState;
    slash: {
        active: boolean;
        range: {from: number; to: number} | null;
        requestRevision: number;
    };
    destroyed: boolean;
}

/** 聚合一次标准建议菜单打开操作所需的状态、候选、命令和可选定位锚点。 */
export interface OpenSuggestionMenuOptions {
    state: SuggestionMenuState;
    items: BlockHit[];
    command: (item: BlockHit) => void;
    clientRect?: () => DOMRect | null;
}

/** 表示一次已解析的 Slash 查询、替换区间和标准菜单定位锚点。 */
export interface SlashMatch {
    query: string;
    range: {from: number; to: number};
    clientRect: () => DOMRect;
}

/** 聚合创建一个 Tiptap Composer 所需的宿主、实例状态和回调。 */
export interface CreateAgentTiptapEditorOptions {
    host: HTMLElement;
    history: ComposerHistoryState;
    interaction: TiptapComposerInteractionState;
    onSend: () => void;
    onChange?: ComposerChangeCallback;
    /** 上游编辑态选项：初始内容、占位覆盖、Escape 取消与历史开关。 */
    composerOptions?: AgentComposerOptions;
}

/** 聚合一次键盘分派所需的编辑器、历史、交互状态和发送动作。 */
export interface TiptapComposerKeyDownContext {
    editor: Editor;
    history: ComposerHistoryState;
    state: TiptapComposerInteractionState;
    onSend: () => void;
    /** Escape 触发的取消回调（上游编辑态协议，如退出用户消息编辑）。 */
    onCancel?: (() => void) | undefined;
    /** 关闭 ↑↓ 历史翻阅；编辑态等场景为 false。 */
    enableHistory: boolean;
}
