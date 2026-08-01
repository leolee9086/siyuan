/** 用途：提供 Tiptap 文档节点；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {Document} from "./imports";
/** 用途：实例化 Tiptap 编辑器；使用范围：独立 Agent Composer 组合边界；解耦评估：具体类只在 factory 文件创建。 */
import {Editor} from "./imports";
/** 用途：提供 Tiptap 换行节点；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {HardBreak} from "./imports";
/** 用途：提供 Tiptap 撤销历史；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {History} from "./imports";
/** 用途：提供 Tiptap 段落节点；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {Paragraph} from "./imports";
/** 用途：提供 Tiptap 占位符；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {Placeholder} from "./imports";
/** 用途：提供 Tiptap 文本节点；使用范围：独立 Agent Composer 扩展集合；解耦评估：经目录网关复用第三方公开扩展。 */
import {Text} from "./imports";
/** 用途：约束 Tiptap 扩展集合；使用范围：实例级扩展构建。 */
import type {Extensions} from "./imports";
/** 用途：分派编辑器键盘行为；使用范围：Tiptap editorProps；解耦评估：纯函数接收全部状态和事件。 */
import {handleTiptapComposerKeyDown} from "./keydown";
/** 用途：创建 @ 引用扩展；使用范围：Tiptap 扩展列表；解耦评估：引用查询和菜单生命周期已隔离在独立适配模块。 */
import {createAgentComposerMentionExtension} from "./mention";
/** 用途：根据编辑器更新刷新 Slash 建议；使用范围：Tiptap update 事件；解耦评估：异步结果只写入显式聚合状态。 */
import {updateTiptapSlashSuggestions} from "./slash";
/** 用途：在编辑器失焦时使 Slash 请求失效；使用范围：Tiptap blur 事件；解耦评估：明确事件状态替代瞬时焦点标志。 */
import {handleTiptapSlashBlur} from "./slash";
/** 用途：约束编辑器工厂聚合选项；使用范围：扩展构建与编辑器实例化。 */
import type {CreateAgentTiptapEditorOptions} from "./types";

/** 构建包含实例级 Mention 状态和当前语言占位符的 Tiptap 扩展集合。 */
const createAgentTiptapExtensions = (options: CreateAgentTiptapEditorOptions) => {
    const extensions: Extensions = [Document, Paragraph, Text];
    extensions.push(HardBreak);
    extensions.push(History);
    extensions.push(Placeholder.configure({
        placeholder: window.siyuan.languages.agentInputPlaceholder || "输入消息，@引用文档...",
    }));
    extensions.push(createAgentComposerMentionExtension(options.interaction.suggestion));
    return extensions;
};

/** @同步豁免: UI构建 Tiptap 必须在挂载调用中同步创建并返回，异步化会破坏 ComposerHandle 初始化协议。 */
/** 在唯一实例化边界创建 Tiptap，并把事件转发给可独立测试的处理器。 */
export const createAgentTiptapEditor = (options: CreateAgentTiptapEditorOptions) => {
    const editor = new Editor({
        element: options.host,
        extensions: createAgentTiptapExtensions(options),
        editorProps: {
            attributes: {class: "agent-composer__pm"},
            /** 将第三方键盘回调转成显式上下文分派，不在 Editor 实例上附加状态。 */
            handleKeyDown: (_view, event) => handleTiptapComposerKeyDown(
                {
                    editor,
                    history: options.history,
                    state: options.interaction,
                    onSend: options.onSend,
                },
                event,
            ),
        },
    });
    editor.on("update",
        /** 编辑内容变化时同步通知宿主，并以当前选择刷新 Slash 请求版本。 */
        () => {
            options.onChange?.();
            updateTiptapSlashSuggestions(editor, options.interaction);
        });
    editor.on("blur",
        /** 焦点离开编辑器时由显式相关目标决定是否终止 Slash 状态。 */
        ({event}) => handleTiptapSlashBlur(options.interaction, event));
    return editor;
};
