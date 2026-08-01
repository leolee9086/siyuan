/** 用途：约束 Tiptap 编辑器；使用范围：Composer 公共句柄实现。 */
import type {Editor} from "./imports";
/** 用途：约束 Tiptap 插入内容结构；使用范围：纯文本和 Mention 插入。 */
import type {JSONContent} from "./imports";
/** 用途：追加 Composer 历史；使用范围：公共句柄发送完成动作；解耦评估：纯状态转换通过目录网关复用。 */
import {pushComposerHistory} from "./imports";
/** 用途：清空 Composer 历史；使用范围：公共句柄会话清理；解耦评估：纯状态转换通过目录网关复用。 */
import {clearComposerHistory} from "./imports";
/** 用途：恢复 Composer 历史；使用范围：公共句柄会话切换；解耦评估：纯状态转换通过目录网关复用。 */
import {restoreComposerHistory} from "./imports";
/** 用途：约束 Composer 历史状态；使用范围：公共句柄的历史方法。 */
import type {ComposerHistoryState} from "../AgentComposer.history.types";
/** 用途：约束 ProseMirror 节点；使用范围：发送数据投影。 */
import type {Node} from "./imports";
/** 用途：终止菜单与未完成 Slash 请求；使用范围：Composer 销毁；解耦评估：销毁动作接收公开聚合状态。 */
import {destroyTiptapComposerInteraction} from "./slash";
/** 用途：约束 Composer 聚合交互状态；使用范围：公共句柄销毁。 */
import type {TiptapComposerInteractionState} from "./types";
/** 用途：实现两种 Composer 共享的公共协议；使用范围：Tiptap 句柄返回值。 */
import type {ComposerHandle} from "../AgentComposer.types";

/**
 * 作用：把单个 ProseMirror 节点投影到发送快照累加器；意图：遍历回调保持短小可审计；
 * 调用时机：readTiptapSendData 遍历当前文档；问题/改进：Mention 与普通文本保持互斥处理。
 */
const collectTiptapSendNode = (
    node: Node,
    references: Array<{id: string; title: string}>,
    textParts: string[],
) => {
    // Mention 节点同时贡献可读文本和结构化引用，且不按普通文本重复采集。
    if (node.type.name === "mention") {
        references.push({id: node.attrs.id, title: node.attrs.label});
        textParts.push(`@${node.attrs.label || node.attrs.id}`);
        return;
    }
    // 普通文本节点只进入发送文本，HTML 由 Tiptap 自身序列化。
    if (node.isText && node.text) {
        textParts.push(node.text);
    }
};

/**
 * 作用：从 Tiptap 文档投影发送文本、HTML 和块引用；意图：发送层不读取编辑器内部节点；
 * 调用时机：Agent 提交消息前；问题/改进：当前文本投影保持既有 Mention 拼接语义。
 */
const readTiptapSendData = (editor: Editor) => {
    const references: Array<{id: string; title: string}> = [];
    const textParts: string[] = [];
    editor.state.doc.descendants((node) => collectTiptapSendNode(node, references, textParts));
    return {text: textParts.join("").trim(), blockHTML: editor.getHTML(), references};
};

/**
 * 作用：用纯文本整体替换编辑器文档；意图：每行映射为独立段落并保留空行；
 * 调用时机：恢复草稿或历史消息；问题/改进：结构化 Mention 不从纯文本反推。
 */
const setTiptapText = (editor: Editor, text: string) => {
    const content = text.split("\n").map((line) => ({
        type: "paragraph",
        content: line ? [{type: "text", text: line}] : [],
    }));
    editor.commands.setContent({type: "doc", content});
};

/**
 * 作用：在当前选择插入多行纯文本；意图：使用 hardBreak 保持同一消息编辑语义；
 * 调用时机：附件链接或外部文本注入；问题/改进：空字符串直接忽略。
 */
const insertTiptapText = (editor: Editor, text: string) => {
    // 空输入不触发 focus 或编辑器事务，避免无意义的内容变化通知。
    if (!text) {
        return;
    }
    const content: JSONContent[] = [];
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        // 第二行起插入 hardBreak，保持调用者传入的换行边界。
        if (index > 0) {
            content.push({type: "hardBreak"});
        }
        // 空行只需要前面的 hardBreak，不创建空文本节点。
        if (line) {
            content.push({type: "text", text: line});
        }
    }
    editor.chain().focus().insertContent(content).run();
};

/**
 * 作用：以单个事务插入一个或多个块引用；意图：避免多次 focus 导致选择重置；
 * 调用时机：块拖放或外部引用动作；问题/改进：调用者负责去重和标签解析。
 */
const insertTiptapMentions = (editor: Editor, mentions: Array<{id: string; label: string}>) => {
    const content: JSONContent[] = [];
    for (const mention of mentions) {
        content.push({type: "mention", attrs: {id: mention.id, label: mention.label}});
        content.push({type: "text", text: " "});
    }
    // 空引用集合不触发编辑器事务，其余引用一次性提交。
    if (content.length > 0) {
        editor.chain().focus().insertContent(content).run();
    }
};

/** @同步豁免: UI构建 挂载入口必须同步返回可立即使用的 ComposerHandle，异步化会破坏面板初始化协议。 */
/** 将 Tiptap 能力投影为 Agent Composer 的稳定公共句柄。 @显式返回类型原因: 公共适配器必须在编译期覆盖完整 ComposerHandle 契约。 */
export const createAgentTiptapComposerHandle = (
    editor: Editor,
    history: ComposerHistoryState,
    interaction: TiptapComposerInteractionState,
): ComposerHandle => ({
    /** 聚焦当前 Composer；供面板打开和插入动作在操作前恢复选择。 */
    focus: () => editor.commands.focus(),
    /** 先终止菜单和异步请求，再销毁编辑器实例；由面板生命周期调用一次。 */
    destroy: () => {
        destroyTiptapComposerInteraction(interaction);
        editor.destroy();
    },
    /** 在发送前读取当前文本、HTML 和引用快照。 */
    getSendData: () => readTiptapSendData(editor),
    /** 发送成功后清空当前编辑器内容。 */
    clear: () => editor.commands.clearContent(),
    /** 恢复草稿或历史消息时整体设置纯文本。 */
    setText: (text) => setTiptapText(editor, text),
    /** 在当前选择插入附件链接或外部文本。 */
    insertText: (text) => insertTiptapText(editor, text),
    /** 发送成功后记录去重历史项。 */
    pushHistory: (text) => pushComposerHistory(history, text),
    /** 会话保存时返回历史快照。 */
    getHistory: () => history.items.slice(),
    /** 会话清理时移除当前历史。 */
    clearHistory: () => clearComposerHistory(history),
    /** 会话切换时恢复对应历史快照。 */
    restoreHistory: (items) => restoreComposerHistory(history, items),
    /** 外部单块引用动作插入一个 Mention。 */
    insertMention: (id, label) => insertTiptapMentions(editor, [{id, label}]),
    /** 拖放动作以单事务插入多个 Mention。 */
    insertMentions: (mentions) => insertTiptapMentions(editor, mentions),
    /** Tiptap 已维护自身 HTML，兼容回调只需立即通知渲染完成。 */
    renderBlockHTML: (_element, onRender) => onRender(),
});
