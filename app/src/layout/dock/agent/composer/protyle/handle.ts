/** 用途：清空 Composer 历史；使用范围：会话清理；解耦评估：纯状态转换经目录网关复用。 */
import {clearComposerHistory} from "./imports";
/** 用途：追加 Composer 历史；使用范围：发送完成；解耦评估：纯状态转换经目录网关复用。 */
import {pushComposerHistory} from "./imports";
/** 用途：退出历史浏览；使用范围：清空和设置草稿；解耦评估：纯状态转换经目录网关复用。 */
import {resetComposerHistoryCursor} from "./imports";
/** 用途：恢复 Composer 历史；使用范围：会话切换；解耦评估：纯状态转换经目录网关复用。 */
import {restoreComposerHistory} from "./imports";
/** 用途：约束公共 Composer 句柄；使用范围：Protyle 适配器返回值。 */
import type {ComposerHandle} from "./imports";
/** 用途：把光标聚焦到最后一个块；使用范围：toEnd 聚焦协议；解耦评估：选择工具经目录网关复用。 */
import {focusBlock} from "./imports";
/** 用途：插入 Protyle 块引用；使用范围：单个和批量 Mention 动作；解耦评估：DOM 规则集中在内容模块并显式接收当前运行时。 */
import {insertProtyleComposerMentions} from "./content";
/** 用途：插入 Protyle 纯文本；使用范围：附件和外部草稿追加；解耦评估：DOM 规则集中在内容模块并显式接收当前运行时。 */
import {insertProtyleComposerText} from "./content";
/** 用途：读取发送快照；使用范围：Agent 提交前；解耦评估：DOM 投影集中在内容模块并显式接收当前运行时。 */
import {readProtyleComposerSendData} from "./content";
/** 用途：渲染消息块；使用范围：聊天消息投影；解耦评估：渲染规则集中在内容模块并显式接收当前运行时。 */
import {renderProtyleComposerBlockHTML} from "./content";
/** 用途：恢复标准空内容；使用范围：发送完成后的 clear；解耦评估：DOM 规则集中在内容模块并显式接收当前运行时。 */
import {resetProtyleComposerContent} from "./content";
/** 用途：整体设置 Protyle 草稿；使用范围：编辑和会话恢复；解耦评估：DOM 规则集中在内容模块并显式接收当前运行时。 */
import {setProtyleComposerText} from "./content";
/** 用途：刷新空状态；使用范围：同步 clear；解耦评估：状态从真实 DOM 推导，不注入副本。 */
import {updateProtyleComposerPlaceholder} from "./content";
/** 用途：约束完整 Protyle 生命周期资源；使用范围：公共句柄所有动作。 */
import type {AgentProtyleComposerRuntime} from "./types";

/** @同步豁免: UI构建 挂载入口必须同步返回可立即使用的 ComposerHandle。 */
/** 将显式 Protyle 资源状态投影为两种 Composer 共用的稳定公共句柄。 @显式返回类型原因: 适配器必须在编译期覆盖完整 ComposerHandle 契约。 */
export const createAgentProtyleComposerHandle = (runtime: AgentProtyleComposerRuntime): ComposerHandle => ({
    /** 聚焦当前 Protyle Composer；toEnd 时先把光标移到最后一个块（上游移动端协议）。 */
    focus: (toEnd = false) => {
        // 末尾块聚焦失败（如空内容）时回退整体聚焦，保证句柄总有可用焦点出口。
        if (!toEnd || !focusBlock(runtime.wysiwyg.element.lastElementChild, runtime.wysiwyg.element, false)) {
            runtime.editor.focus();
        }
    },
    /** 终止异步 Hint、DOM 观察和事件监听，再由 Protyle 释放自身菜单与编辑器资源。 */
    destroy: () => {
        // 重复销毁不再次触发第三方编辑器生命周期。
        if (runtime.suggestion.destroyed) {
            return;
        }
        runtime.suggestion.destroyed = true;
        runtime.suggestion.requestRevision++;
        runtime.contentObserver?.disconnect();
        // 已注册键盘处理器时从同一捕获阶段移除。
        if (runtime.keydownHandler) {
            runtime.wysiwyg.element.removeEventListener("keydown", runtime.keydownHandler, true);
        }
        // 已注册失焦处理器时解除其异步请求失效动作。
        if (runtime.blurHandler) {
            runtime.wysiwyg.element.removeEventListener("blur", runtime.blurHandler);
        }
        runtime.contentObserver = null;
        runtime.keydownHandler = null;
        runtime.blurHandler = null;
        runtime.editor.destroy();
        // Hint 元素在创建时被挂到 document.body（上游浮动 Dock 协议），销毁时必须随之移除。
        runtime.hint.element.remove();
    },
    /** 在发送前读取当前文本、HTML 和引用快照。 */
    getSendData: () => readProtyleComposerSendData(runtime),
    /** 发送成功后恢复标准空块并清空撤销与历史浏览游标。 */
    clear: () => {
        resetProtyleComposerContent(runtime);
        runtime.protyle.undo.clear();
        updateProtyleComposerPlaceholder(runtime);
        resetComposerHistoryCursor(runtime.history);
    },
    /** 恢复草稿或历史消息时整体设置 Markdown。 */
    setText: (text) => {
        setProtyleComposerText(runtime, text);
        resetComposerHistoryCursor(runtime.history);
    },
    /** 在当前选择插入附件链接或外部纯文本。 */
    insertText: (text) => insertProtyleComposerText(runtime, text),
    /** 发送成功后记录去重历史项。 */
    pushHistory: (text) => pushComposerHistory(runtime.history, text),
    /** 会话保存时返回历史快照。 */
    getHistory: () => runtime.history.items.slice(),
    /** 会话清理时移除当前历史。 */
    clearHistory: () => clearComposerHistory(runtime.history),
    /** 会话切换时恢复对应历史快照。 */
    restoreHistory: (items) => restoreComposerHistory(runtime.history, items),
    /** 外部单块引用动作插入一个 Mention。 */
    insertMention: (id, label) => insertProtyleComposerMentions(runtime, [{id, label}]),
    /** 拖放动作一次插入多个 Mention。 */
    insertMentions: (mentions) => insertProtyleComposerMentions(runtime, mentions),
    /** 消息投影复用当前 Protyle 块渲染生命周期。 */
    renderBlockHTML: (element, onRender) => renderProtyleComposerBlockHTML(runtime, element, onRender),
});
