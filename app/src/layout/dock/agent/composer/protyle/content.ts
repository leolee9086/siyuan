/** 用途：渲染 Protyle 块内容；使用范围：Composer 发送后消息投影；解耦评估：复用编辑器自身渲染生命周期。 */
import {blockRender} from "./imports";
/** 用途：读取零宽空白协议；使用范围：空状态与 Mention 插入；解耦评估：只读平台常量经目录网关进入。 */
import {Constants} from "./imports";
/** 用途：转义插入文本和引用标签；使用范围：Protyle HTML 写入；解耦评估：纯字符串能力经目录网关复用。 */
import {escapeHtml} from "./imports";
/** 用途：创建 Protyle 标准空块；使用范围：初始化和清空；解耦评估：编辑器 DOM 工厂保持唯一实现。 */
import {genEmptyElement} from "./imports";
/** 用途：约束 Protyle 生命周期资源；使用范围：所有内容读写函数。 */
import type {AgentProtyleComposerRuntime} from "./types";

/** @同步豁免: UI构建 块消息渲染前必须同步移除旧嵌入结果，避免复制瞬态 DOM。 */
/** 清除查询嵌入的渲染标记和派生子节点，只保留可再次渲染的源结构。 */
export const resetProtyleEmbedBlocks = (element: HTMLElement) => {
    const embedElements = element.querySelectorAll<HTMLElement>('[data-type="NodeBlockQueryEmbed"]');
    for (const embedElement of embedElements) {
        embedElement.removeAttribute("data-render");
        embedElement.style.height = "";
        const children = Array.from(embedElement.children);
        for (const child of children) {
            // 派生的嵌入结果必须丢弃，源节点和其它结构继续保留。
            if (child.classList.contains("protyle-wysiwyg__embed")) {
                child.remove();
            }
        }
    }
};

/** @同步豁免: UI构建 初始化和发送清理必须在当前编辑器事务前恢复标准空块。 */
/** 用 Protyle 标准空段落重置 Composer，并恢复 Agent 输入占位信息。 */
export const resetProtyleComposerContent = (runtime: AgentProtyleComposerRuntime) => {
    runtime.wysiwyg.element.innerHTML = "";
    const emptyElement = genEmptyElement(false, false);
    const paragraph = emptyElement.firstElementChild;
    // DOM 工厂必须提供可编辑段落，缺失表示 Protyle 初始化契约已损坏。
    if (!(paragraph instanceof HTMLElement)) {
        throw new Error("Agent Protyle Composer requires an editable paragraph");
    }
    paragraph.classList.add("protyle-wysiwyg--empty");
    // 上游协议：宿主可覆盖默认占位文案（如移动端短占位）。
    paragraph.setAttribute("placeholder",
        runtime.interaction.placeholder || window.siyuan.languages.agentInputPlaceholder);
    runtime.wysiwyg.element.appendChild(emptyElement);
};

/** @同步豁免: UI构建 初始草稿必须在首个观察器通知前同步写入编辑器。 */
/** 按上游编辑态恢复协议装载初始内容：块 DOM 快照优先，Markdown 草稿次之，缺省回落标准空块。 */
export const loadProtyleComposerInitialContent = (
    runtime: AgentProtyleComposerRuntime,
    initialContent: string | undefined,
    initialBlockHTML: string | undefined,
) => {
    // 编辑恢复的主路径：直接还原发送时的块结构，并重置嵌入块后重新渲染。
    if (initialBlockHTML) {
        runtime.wysiwyg.element.innerHTML = initialBlockHTML;
        resetProtyleEmbedBlocks(runtime.wysiwyg.element);
        blockRender(runtime.protyle, runtime.wysiwyg.element);
        return;
    }
    // 编辑恢复的降级路径：把 Markdown 草稿转换为块 DOM 后渲染。
    if (initialContent) {
        runtime.wysiwyg.element.innerHTML = runtime.protyle.lute.Md2BlockDOM(initialContent);
        blockRender(runtime.protyle, runtime.wysiwyg.element);
        return;
    }
    resetProtyleComposerContent(runtime);
};

/** @同步豁免: UI构建 输入变化后必须在当前观察器回调中同步刷新空状态类。 */
/** 从实际 Protyle DOM 推导空状态，不维护第二份不可观察文本缓存。 */
export const updateProtyleComposerPlaceholder = (runtime: AgentProtyleComposerRuntime) => {
    const text = runtime.wysiwyg.element.textContent || "";
    const isEmpty = text.replace(new RegExp(Constants.ZWSP, "g"), "").trim() === "";
    runtime.wysiwyg.element.classList.toggle("agent-composer--empty", isEmpty);
};

/** @同步豁免: 性能考虑 keydown 热路径直接读取当前 DOM，异步化会错过当前按键分派。 */
/** 判断当前 Protyle Composer 是否只包含空白和零宽占位字符。 */
export const isProtyleComposerEmpty = (runtime: AgentProtyleComposerRuntime) => {
    const text = runtime.wysiwyg.element.textContent || "";
    return text.replace(new RegExp(Constants.ZWSP, "g"), "").trim() === "";
};

/** @同步豁免: 生命周期 发送请求必须同步快照同一帧内的文本、HTML 和引用。 */
/** 从当前 Protyle DOM 投影稳定发送数据，并剥离派生嵌入内容。 */
export const readProtyleComposerSendData = (runtime: AgentProtyleComposerRuntime) => {
    const references: Array<{id: string; title: string}> = [];
    const referenceElements = runtime.wysiwyg.element.querySelectorAll<HTMLElement>('[data-type~="block-ref"]');
    for (const referenceElement of referenceElements) {
        references.push({
            id: referenceElement.getAttribute("data-id") || "",
            title: referenceElement.textContent || "",
        });
    }
    const clonedNode = runtime.wysiwyg.element.cloneNode(true);
    if (!(clonedNode instanceof HTMLElement)) {
        throw new Error("Agent Protyle Composer requires an HTML clone");
    }
    resetProtyleEmbedBlocks(clonedNode);
    return {
        text: runtime.protyle.lute.BlockDOM2StdMd(runtime.wysiwyg.element.innerHTML).trim(),
        blockHTML: clonedNode.innerHTML,
        references,
    };
};

/** @同步豁免: 生命周期 草稿恢复必须在会话切换完成前同步更新编辑器内容和撤销栈。 */
/** 用 Markdown 整体替换 Composer；空文本恢复标准空块。 */
export const setProtyleComposerText = (runtime: AgentProtyleComposerRuntime, text: string) => {
    // 空文本需要标准占位结构，完成清理后不再进入 Markdown 转换分支。
    if (!text.trim()) {
        resetProtyleComposerContent(runtime);
        runtime.protyle.undo.clear();
        updateProtyleComposerPlaceholder(runtime);
        return;
    }
    runtime.wysiwyg.element.innerHTML = runtime.protyle.lute.Md2BlockDOM(text);
    runtime.protyle.undo.clear();
    updateProtyleComposerPlaceholder(runtime);
};

/** @同步豁免: UI构建 外部文本插入必须保持当前 Protyle 选择位置。 */
/** 在当前选择插入已转义纯文本，并把换行映射为 Protyle 可接受的 br。 */
export const insertProtyleComposerText = (runtime: AgentProtyleComposerRuntime, text: string) => {
    if (text) {
        runtime.editor.insert(escapeHtml(text).replaceAll("\n", "<br>"));
    }
};

/** @同步豁免: UI构建 外部引用动作必须在当前选择中同步提交完整 HTML。 */
/** 一次插入一个或多个块引用，避免多次恢复焦点改变选择位置。 */
export const insertProtyleComposerMentions = (
    runtime: AgentProtyleComposerRuntime,
    mentions: Array<{id: string; label: string}>,
) => {
    const htmlParts: string[] = [];
    for (const mention of mentions) {
        htmlParts.push('<span data-type="block-ref" data-id="' + mention.id + '" data-subtype="d">' +
            escapeHtml(mention.label) + "</span>" + Constants.ZWSP + " ");
    }
    const html = htmlParts.join("");
    if (html) {
        runtime.editor.insert(html);
    }
};

/** @同步豁免: UI构建 消息插入后必须立刻启动 Protyle 块渲染生命周期。 */
/** 清理旧嵌入投影后复用当前 Protyle 实例渲染消息块。 */
export const renderProtyleComposerBlockHTML = (
    runtime: AgentProtyleComposerRuntime,
    element: HTMLElement,
    onRender: () => void,
) => {
    resetProtyleEmbedBlocks(element);
    blockRender(runtime.protyle, element, undefined, onRender);
};
