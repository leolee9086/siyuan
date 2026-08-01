/** 用途：创建每个 Composer 的发送历史；使用范围：Tiptap 挂载组合根；解耦评估：状态构造与转换同属历史领域。 */
import {createComposerHistory} from "./composer/AgentComposer.history";
/** 用途：在唯一工厂边界实例化 Tiptap；使用范围：独立 Agent Composer 挂载；解耦评估：挂载入口只依赖工厂，不接触具体构造器。 */
import {createAgentTiptapEditor} from "./composer/tiptap/editor.factory";
/** 用途：创建公共 Composer 句柄；使用范围：Tiptap 挂载返回值；解耦评估：句柄投影与编辑器实例化分离。 */
import {createAgentTiptapComposerHandle} from "./composer/tiptap/handle";
/** 用途：创建可观察菜单与 Slash 状态；使用范围：Tiptap 挂载组合根；解耦评估：每个 Composer 使用独立状态对象，无模块级可变状态。 */
import {createTiptapComposerInteractionState} from "./composer/tiptap/state.factory";
/** 用途：约束内容变化通知；使用范围：Tiptap 挂载签名。 */
import type {ComposerChangeCallback} from "./composer/AgentComposer.types";
/** 用途：约束公共句柄；使用范围：Tiptap 挂载返回值。 */
import type {ComposerHandle} from "./composer/AgentComposer.types";

/** @同步豁免: UI构建 面板挂载必须同步返回 ComposerHandle，异步化会改变所有宿主初始化协议。 */
/** 组装独立 Tiptap Composer；编辑器、历史和交互状态均保持实例级生命周期。 @显式返回类型原因: 对外挂载入口必须固定实现共享 ComposerHandle 契约。 */
export function mountTiptapComposer(
    host: HTMLElement,
    onSend: () => void,
    onChange?: ComposerChangeCallback,
): ComposerHandle {
    const history = createComposerHistory();
    const interaction = createTiptapComposerInteractionState(host);
    const editor = createAgentTiptapEditor({host, history, interaction, onSend, onChange});
    return createAgentTiptapComposerHandle(editor, history, interaction);
}
