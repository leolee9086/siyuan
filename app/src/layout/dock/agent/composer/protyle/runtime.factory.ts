/** 用途：约束完整应用宿主；使用范围：Protyle 运行时实例化边界。 */
import type {AppFacade} from "./imports";
/** 用途：约束内容变化通知；使用范围：DOM 观察器回调。 */
import type {ComposerChangeCallback} from "./imports";
/** 用途：约束显式 Composer 历史状态；使用范围：运行时装配。 */
import type {ComposerHistoryState} from "./imports";
/** 用途：初始化标准空内容；使用范围：Protyle 创建完成后；解耦评估：内容 DOM 规则集中在内容模块。 */
import {loadProtyleComposerInitialContent} from "./content";
/** 用途：从实际 DOM 刷新占位状态；使用范围：初始化和 MutationObserver；解耦评估：内容状态只由 DOM 推导，不注入第二份缓存。 */
import {updateProtyleComposerPlaceholder} from "./content";
/** 用途：创建 Protyle 原生引用与技能 Hint；使用范围：编辑器初始化选项；解耦评估：不创建额外遮罩或菜单宿主。 */
import {createAgentProtyleHintOptions} from "./hints";
/** 用途：分派 Composer 键盘行为；使用范围：WYSIWYG 捕获阶段；解耦评估：处理器显式接收完整实例状态。 */
import {handleProtyleComposerKeyDown} from "./keydown";
/** 用途：约束完整可观察运行时；使用范围：组合结果。 */
import type {AgentProtyleComposerRuntime} from "./types";
/** 用途：约束上游编辑态挂载选项；使用范围：运行时装配。 */
import type {AgentComposerOptions} from "./imports";

/** 上游浮动 Dock 协议类名：附加后 Hint 由顶层样式固定定位，样式见 _ai_agent.scss。 */
const AGENT_HINT_OVERLAY_CLASS = "protyle-hint--agent-overlay";

/** 使用完整 App 能力创建轻量 Protyle，并验证 Composer 必需的 WYSIWYG 与 Hint 能力。 */
const createRequiredComposerEditor = (
    app: AppFacade,
    host: HTMLElement,
    suggestion: AgentProtyleComposerRuntime["suggestion"],
) => {
    const editor = app.createProtyle(host, {
        lite: true,
        blockId: "",
        render: {
            gutter: false,
            breadcrumb: false,
            scroll: false,
            background: false,
            title: false,
        },
        hint: createAgentProtyleHintOptions(suggestion),
    });
    const protyle = editor.protyle;
    const wysiwyg = protyle.wysiwyg;
    // Agent Composer 必须获得可编辑根节点，缺失时释放半初始化 Protyle 并暴露配置错误。
    if (!wysiwyg) {
        editor.destroy();
        throw new Error("Agent Protyle Composer requires a WYSIWYG runtime");
    }
    const hint = protyle.hint;
    // Slash 技能入口依赖 Protyle 原生 Hint，缺失时释放半初始化实例。
    if (!hint) {
        editor.destroy();
        throw new Error("Agent Protyle Composer requires a Hint runtime");
    }
    return {editor, protyle, wysiwyg, hint};
};

/** @同步豁免: UI构建 面板初始化必须同步创建 Protyle 并返回完整资源状态。 */
/** 创建一个 Protyle Composer 的编辑器、观察器、事件处理器和异步 Hint 版本状态。 @显式返回类型原因: 组合根需要编译期保证所有可释放资源都进入公开运行时契约。 */
export const createAgentProtyleComposerRuntime = (
    app: AppFacade,
    host: HTMLElement,
    options: {
        history: ComposerHistoryState;
        onSend: () => void;
        onChange: ComposerChangeCallback | undefined;
        composerOptions?: AgentComposerOptions;
    },
): AgentProtyleComposerRuntime => {
    const suggestion = {destroyed: false, requestRevision: 0};
    const {editor, protyle, wysiwyg, hint} = createRequiredComposerEditor(app, host, suggestion);
    // 上游浮动 Dock 修复：Hint 使用视口坐标定位，挂到顶层可避免受宿主变换坐标系和裁剪影响。
    hint.element.classList.add(AGENT_HINT_OVERLAY_CLASS);
    document.body.appendChild(hint.element);
    wysiwyg.element.setAttribute("data-readonly", "false");
    const composerOptions = options.composerOptions ?? {};
    const runtime: AgentProtyleComposerRuntime = {
        editor,
        protyle,
        wysiwyg,
        hint,
        history: options.history,
        onSend: options.onSend,
        interaction: {
            placeholder: composerOptions.placeholder,
            onCancel: composerOptions.onCancel,
            enableHistory: composerOptions.enableHistory !== false,
        },
        suggestion,
        contentObserver: null,
        keydownHandler: null,
        blurHandler: null,
    };
    loadProtyleComposerInitialContent(runtime, composerOptions.initialContent, composerOptions.initialBlockHTML);
    updateProtyleComposerPlaceholder(runtime);
    /** 粘贴、块删除和程序化插入可能不派发 input，因此从实际 DOM 统一通知宿主。 */
    runtime.contentObserver = new MutationObserver(() => {
        updateProtyleComposerPlaceholder(runtime);
        options.onChange?.();
    });
    /** 捕获阶段先处理 Hint、发送和历史，撤销重做继续交给 Protyle 自身。 */
    runtime.keydownHandler = (event) => handleProtyleComposerKeyDown(runtime, event);
    /** 失焦后立即使尚未完成的技能响应失效，避免迟到结果重新显示 Hint。 */
    runtime.blurHandler = () => {
        suggestion.requestRevision++;
    };
    runtime.contentObserver.observe(wysiwyg.element, {childList: true, characterData: true, subtree: true});
    wysiwyg.element.addEventListener("keydown", runtime.keydownHandler, true);
    wysiwyg.element.addEventListener("blur", runtime.blurHandler);
    return runtime;
};
