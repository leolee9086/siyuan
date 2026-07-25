import { Constants } from "../../../constants";
import type { WYSIWYG } from "../../wysiwyg";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { hasPreviousSibling, hasNextSibling } from "../getBlock";
import { getSelectionOffset } from "../../util/selection";

/**
 * DOM 元素的属性黑名单，这些属性不应被自定义属性覆盖或随意删除
 */
const DOM属性黑名单 = ["type", "class", "spellcheck", "contenteditable", "data-doc-type", "style", "data-realwidth", "data-readonly"];

/**
 * IAL（属性列表）中的黑名单，这些内部属性不应作为普通 HTML 属性渲染到 DOM 上
 */
const IAL属性黑名单 = ["title-img", "title", "updated", "icon", "id", "type", "class", "spellcheck", "contenteditable", "data-doc-type", "style", "data-realwidth", "data-readonly", "av-names"];

/**
 * 渲染自定义属性到 DOM 节点
 * 
 * - 作用：根据传入的 ial 属性更新 wysiwyg 元素的 DOM 属性，处理全宽显示，并清理多余属性。
 * - 意图：保证 DOM 属性与数据层 (ial) 同步，防止残留属性导致的显示问题。
 * - 调用时机：在渲染块或更新块属性时调用，例如 updateTransaction 中。
 */
export const renderCustomWithCtx = (ctx: { ial: IObject, wysiwyg: WYSIWYG }) => {
    const { ial, wysiwyg } = ctx;
    let isFullWidth = ial[Constants.CUSTOM_SY_FULLWIDTH];
    if (!isFullWidth) {
        isFullWidth = getSiyuanConfig().editor.fullWidth ? "true" : "false";
    }
    const parent = wysiwyg.element.parentElement;
    if (parent) {
        parent.removeAttribute("data-fullwidth");
    }
    if (parent && isFullWidth === "true") {
        parent.setAttribute("data-fullwidth", "true");
    }
    const ialKeys = Object.keys(ial);
    const attributes = Array.from(wysiwyg.element.attributes);
    for (const attr of attributes) {
        const oldKey = attr.nodeName;
        if (!DOM属性黑名单.includes(oldKey) && !ialKeys.includes(oldKey)) {
            wysiwyg.element.removeAttribute(oldKey);
        }
    }
    for (const key of ialKeys) {
        const value = ial[key];
        if (value !== undefined && !IAL属性黑名单.includes(key)) {
            wysiwyg.element.setAttribute(key, value);
        }
    }
};

/**
 * 获取输入数据的实际长度
 * 
 * - 作用：考虑转义字符（如 <, >, &）的长度。
 * - 意图：HTML 内容长度计算需要考虑实体字符。
 * - 调用时机：计算字符串截取位置时。
 */
const 获取数据长度 = (inputData: string) => {
    if (inputData === "<" || inputData === ">") {
        // 使用 inlineElement.innerHTML 会出现 https://ld246.com/article/1627185027423 中的第2个问题
        return 4;
    }
    if (inputData === "&") {
        // https://github.com/siyuan-note/siyuan/issues/12239
        return 5;
    }
    return inputData.length;
};

/**
 * 执行行内元素插入逻辑
 * 
 * - 作用：执行实际的插入操作，分离条件判断与执行逻辑。
 * - 意图：解决嵌套 if 问题。
 * - 调用时机：处理行内插入条件满足时调用。
 */
const 执行行内插入 = (inputData: string, protyle: IProtyle, range: Range, inlineElement: HTMLElement | null) => {
    if (!inlineElement || !protyle.wysiwyg?.element) {
        return;
    }
    const 文本内容 = inlineElement.textContent || "";
    const dataLength = 获取数据长度(inputData);
    const position = getSelectionOffset(inlineElement, protyle.wysiwyg.element, range);

    if (position.start !== 文本内容.length) {
        return;
    }

    const html = inlineElement.innerHTML;
    // 使用 inlineElement.textContent **$a$b** 中数学公式消失
    inlineElement.innerHTML = html.slice(0, html.length - dataLength);
    const textNode = document.createTextNode(inputData);
    inlineElement.after(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);
};

/**
 * 处理特定条件下的行内元素插入
 * 
 * - 作用：在行内公式等特殊元素前插入文字时的处理。
 * - 意图：修复公式消失等问题。
 * - 调用时机：转义行内元素中。
 */
const 处理行内插入 = (inputData: string, protyle: IProtyle, range: Range, inlineElement: HTMLElement | null, currentTypes: string[]) => {
    const 文本内容 = inlineElement?.textContent || "";
    if (// 表格行内公式之前无法插入文字 https://github.com/siyuan-note/siyuan/issues/3908
        inlineElement?.tagName === "SPAN" &&
        文本内容 !== inputData &&
        !currentTypes.includes("search-mark") &&    // https://github.com/siyuan-note/siyuan/issues/7586
        !currentTypes.includes("code") &&   // https://github.com/siyuan-note/siyuan/issues/13871
        !currentTypes.includes("kbd") &&
        !currentTypes.includes("tag") &&
        range.toString() === "" && range.startContainer.nodeType === 3 &&
        (currentTypes.includes("inline-memo") || currentTypes.includes("block-ref") || currentTypes.includes("file-annotation-ref") || currentTypes.includes("a")) &&
        !hasNextSibling(range.startContainer) && (range.startContainer.textContent?.length ?? 0) === range.startOffset &&
        文本内容.length > inputData.length
    ) {
        执行行内插入(inputData, protyle, range, inlineElement);
    }
};

/**
 * 处理光标在行内元素 ZWSP 后的输入
 * 
 * - 作用：修复 ZWSP 后输入导致的内容错误。
 * - 意图：解决 https://github.com/siyuan-note/siyuan/issues/5924
 * - 调用时机：转义行内元素中。
 */
const 处理行内起始 = (inputData: string, range: Range, inlineElement: HTMLElement | null, currentTypes: string[]) => {
    // https://github.com/siyuan-note/siyuan/issues/5924
    const 文本内容 = inlineElement?.textContent || "";
    if (currentTypes.length > 0 && range.toString() === "" && range.startOffset === inputData.length &&
        inlineElement?.tagName === "SPAN" &&
        文本内容.replace(Constants.ZWSP, "") !== inputData &&
        文本内容.replace(Constants.ZWSP, "").length >= inputData.length &&
        !hasPreviousSibling(range.startContainer) && !hasPreviousSibling(inlineElement)) {

        const dataLength = 获取数据长度(inputData);
        const html = inlineElement.innerHTML.replace(Constants.ZWSP, "");
        inlineElement.innerHTML = html.slice(dataLength);
        const textNode = document.createTextNode(inputData);
        inlineElement.before(textNode);
        range.selectNodeContents(textNode);
        range.collapse(false);
        return true;
    }
    return false;
};

/**
 * 处理换行符插入的情况
 * 
 * - 作用：在特定条件下（如行内元素开头换行），调整 DOM 结构。
 * - 意图：修复换行符导致的结构混乱问题 (issue #11766)。
 * - 调用时机：转义行内元素中检测到 insertLineBreak 时。
 */
const 处理换行符 = (range: Range, inlineElement: HTMLElement | null, currentTypes: string[]) => {
    // https://github.com/siyuan-note/siyuan/issues/11766
    if (currentTypes.length > 0 && range.toString() === "" && inlineElement?.tagName === "SPAN" &&
        (inlineElement.textContent?.startsWith("\n") ?? false) &&
        range.startContainer.previousSibling && range.startContainer.previousSibling.textContent === "\n") {
        inlineElement.before(range.startContainer.previousSibling);
    }
};

/**
 * 处理行内元素转义
 * 
 * - 作用：处理编辑器中特定输入（如换行符、特殊字符）在行内元素（如 SPAN）边缘或内部的插入逻辑，防止破坏行内元素结构。
 * - 意图：修复多个行内元素编辑时的边缘情况 bug（如公式消失、光标位置错误等）。
 * - 调用时机：在 input 事件中调用。
 */
export const escapeInline = (protyle: IProtyle, range: Range, event: InputEvent) => {
    if (!event.data && event.inputType !== "insertLineBreak") {
        return;
    }

    if (!protyle.toolbar) {
        return;
    }
    protyle.toolbar.range = range;
    const inlineElement = range.startContainer.parentElement;
    const currentTypes = protyle.toolbar.getCurrentType();

    if (event.inputType === "insertLineBreak") {
        处理换行符(range, inlineElement, currentTypes);
        return;
    }

    const inputData = event.data || "";
    if (处理行内起始(inputData, range, inlineElement, currentTypes)) {
        return;
    }

    处理行内插入(inputData, protyle, range, inlineElement, currentTypes);
};

