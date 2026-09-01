/** 用途：读取转换常量。使用范围：目标 Markdown 和编辑属性标记。解耦评估：通过同域 imports 网关访问稳定协议。 */
import {Constants} from "./imports";
/** 用途：聚焦替换后的块。使用范围：空段落转换完成后。解耦评估：通过同域 imports 网关访问选择能力。 */
import {focusBlock} from "./imports";
/** 用途：关闭转换后的块标工具。使用范围：空段落转换完成后。解耦评估：通过同域 imports 网关访问 UI 命令。 */
import {hideElements} from "./imports";
/** 用途：读取代码语言偏好。使用范围：空段落转代码块。解耦评估：通过同域 imports 网关避免直接读取环境。 */
import {getSiyuanStorage} from "./imports";
/** 用途：读取段落可编辑节点。使用范围：空段落替换准备。解耦评估：通过同域 imports 网关访问块查询。 */
import {getContenteditableElement} from "./imports";
/** 用途：提交可撤销转换。使用范围：空段落转换。解耦评估：通过同域 imports 网关访问提交协议。 */
import {transaction} from "./imports";
/** 用途：刷新转换后的视觉内容。使用范围：空段落转换。解耦评估：通过同域 imports 网关读取低层端口。 */
import {getTransactionTransformVisualEffects} from "./imports";
/** 用途：限定空段落转换目标。使用范围：Markdown 和节点类型映射。解耦评估：纯类型不加载转换命令。 */
import type {TEmptyParagraphTarget} from "../types";
/** 用途：描述已验证的替换节点。使用范围：批量更新操作收集。解耦评估：纯类型不加载 DOM 实现。 */
import type {TEmptyParagraphReplacement} from "./types";

/** 作用：映射空段落转换目标到 Lute 节点类型。意图：验证输出时不持有模块级对象状态。调用时机：Lute 输出校验前。 */
function getTargetNodeType(type: TEmptyParagraphTarget) {
    // 代码块使用 Lute 的标准代码节点类型。
    if (type === "code") {
        return "NodeCodeBlock";
    }
    // 表格使用 Lute 的标准表格节点类型。
    if (type === "table") {
        return "NodeTable";
    }
    return type === "line" ? "NodeThematicBreak" : "NodeMathBlock";
}

/** 作用：为目标类型生成 Lute Markdown。意图：复用引擎的标准块构造能力。调用时机：准备空段落替换节点时。 */
const getTargetMarkdown = (type: TEmptyParagraphTarget) => {
    // 代码块需要携带最近的编辑器语言，而其他目标拥有固定 Markdown 结构。
    if (type === "code") {
        const language = getSiyuanStorage()[Constants.LOCAL_CODELANG] || "";
        const codeLanguage = Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(language) ? "" : language;
        return "```" + codeLanguage + Lute.Caret + "\n```";
    }
    if (type === "table") {
        return `| ${Lute.Caret} |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |`;
    }
    return type === "line" ? "---" : "$$";
};

/** 作用：清理新表格的临时编辑节点。意图：使转换结果符合可编辑表格的最小尺寸约束。调用时机：Lute 生成表格节点后。 */
const prepareTable = (element: HTMLElement) => {
    for (const column of element.querySelectorAll("colgroup col")) {
        // colgroup 可能包含非 HTMLElement 节点，只对可写样式的列更新最小宽度。
        if (column instanceof HTMLElement) {
            column.style.minWidth = "60px";
        }
    }
    for (const wbr of element.querySelectorAll("wbr")) {
        wbr.remove();
    }
};

/** 作用：建立一个可替换的目标块。意图：先验证 Lute 输出，避免部分更新无效 DOM。调用时机：批量空段落转换前。 */
const createReplacement = (protyle: IProtyle, nodeElement: Element, type: TEmptyParagraphTarget) => {
    const clonedNode = nodeElement.cloneNode(true);
    if (!(clonedNode instanceof HTMLElement)) {
        return;
    }
    clonedNode.classList.remove("protyle-wysiwyg--select");
    clonedNode.removeAttribute("select-start");
    clonedNode.removeAttribute("select-end");
    const editableElement = getContenteditableElement(clonedNode);
    if (!editableElement) {
        return;
    }
    const oldHTML = clonedNode.outerHTML;
    editableElement.textContent = getTargetMarkdown(type);
    const template = document.createElement("template");
    template.innerHTML = protyle.lute.SpinBlockDOM(clonedNode.outerHTML);
    const newElement = template.content.firstElementChild;
    // Lute 输出必须保留原块 ID 且符合指定节点类型，否则中止整个批次。
    if (template.content.childElementCount !== 1 || !(newElement instanceof HTMLElement) ||
        newElement.getAttribute("data-node-id") !== clonedNode.getAttribute("data-node-id") ||
        newElement.getAttribute("data-type") !== getTargetNodeType(type)) {
        return;
    }
    // 表格目标需要补齐列宽和移除文本编辑占位符，其他块保留 Lute 原始结构。
    if (newElement.getAttribute("data-type") === "NodeTable") {
        prepareTable(newElement);
    }
    return {nodeElement, oldHTML, newElement};
};

/** 作用：替换 DOM 并构造正反向更新操作。意图：让多段落转换保持一个可撤销事务。调用时机：所有替换节点验证完成后。 */
const applyReplacements = (replacements: TEmptyParagraphReplacement[]) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const newElements: HTMLElement[] = [];
    for (const replacement of replacements) {
        const id = replacement.newElement.getAttribute("data-node-id");
        if (!id) {
            throw new Error("Empty paragraph replacement is missing data-node-id");
        }
        doOperations.push({action: "update", id, data: replacement.newElement.outerHTML});
        undoOperations.push({action: "update", id, data: replacement.oldHTML});
        replacement.nodeElement.insertAdjacentElement("afterend", replacement.newElement);
        replacement.nodeElement.remove();
        replacement.newElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        newElements.push(replacement.newElement);
    }
    return {doOperations, undoOperations, newElements};
};

/**
 * 作用：判断块是否仅包含可移除的编辑占位符。
 * 意图：防止非空文本被结构转换覆盖。
 * 调用时机：快捷键和菜单执行前。
 * @同步豁免: 需要绝对同步的DOM访问 - 快捷键处理必须基于当前选区立即判断段落内容。
 */
export const isEmptyParagraph = (element: Element) => {
    if (element.getAttribute("data-type") !== "NodeParagraph") {
        return false;
    }
    const editableElement = getContenteditableElement(element);
    if (!editableElement) {
        return false;
    }
    const clonedContent = editableElement.cloneNode(true);
    if (!(clonedContent instanceof Element)) {
        return false;
    }
    for (const removableElement of clonedContent.querySelectorAll("br, wbr")) {
        removableElement.remove();
    }
    const text = (clonedContent.textContent || "").replace(new RegExp(Constants.ZWSP, "g"), "").trim();
    return text === "" && clonedContent.childElementCount === 0;
};

/**
 * 作用：将多个空段落转换为结构块。
 * 意图：在一次撤销记录中更新 DOM、渲染和焦点。
 * 调用时机：空段落快捷键或菜单命令执行时。
 * @同步豁免: 需要绝对同步的DOM访问 - 当前输入事件必须连续替换节点、登记事务并恢复焦点。
 */
export const turnEmptyParagraphsIntoTransaction = (options: {
    protyle: IProtyle,
    nodeElements: Element[],
    type: TEmptyParagraphTarget,
}) => {
    if (options.nodeElements.length === 0 || !options.nodeElements.every(isEmptyParagraph)) {
        return;
    }
    const replacements: TEmptyParagraphReplacement[] = [];
    for (const nodeElement of options.nodeElements) {
        const replacement = createReplacement(options.protyle, nodeElement, options.type);
        if (!replacement) {
            return;
        }
        replacements.push(replacement);
    }
    const {doOperations, undoOperations, newElements} = applyReplacements(replacements);
    transaction(options.protyle, doOperations, undoOperations);
    const transformVisualEffects = getTransactionTransformVisualEffects();
    transformVisualEffects.rerender(options.protyle);
    const firstNewElement = newElements[0];
    // 数学块需要打开专用渲染编辑界面，而不是把焦点放在容器上。
    if (firstNewElement && options.type === "math") {
        options.protyle.toolbar.showRender(options.protyle, firstNewElement);
    }
    // 非数学目标保留普通块级编辑焦点，便于用户继续输入。
    if (firstNewElement && options.type !== "math") {
        focusBlock(firstNewElement);
    }
    hideElements(["gutter"], options.protyle);
};
