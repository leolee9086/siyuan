import type {App} from "../../../index";
import {mountTiptapComposer} from "./AgentComposer.tiptap";
import {mountProtyleComposer} from "./AgentComposer.protyle";
import type {ComposerHandle} from "./AgentComposer.types";

/** 统一 Agent Composer 句柄；宿主差异由是否提供完整 App 能力明确选择。 */
export type {ComposerHandle};

/**
 * 挂载 Agent Composer。
 * 完整应用提供 App 时使用 Protyle，独立页/MAGI 最小宿主使用 Tiptap，
 * 两者共享发送、历史、引用和销毁契约，但不伪造缺失的 Protyle 宿主能力。
 */
export function mountComposer(
    host: HTMLElement,
    onSend: () => void,
    onChange?: () => void,
    app?: App,
): ComposerHandle {
    if (app) {
        return mountProtyleComposer(app, host, onSend, onChange);
    }
    return mountTiptapComposer(host, onSend, onChange);
}
