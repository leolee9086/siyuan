import { scrollCenter } from "../../../util/DOM/highlightById";
import { hasNextSibling, hasPreviousSibling } from "../../wysiwyg/getBlock";
import {updateTransaction} from "../../wysiwyg/transaction/update";
import { isNotCtrl } from "../compatibility";
import { TableFixContext } from "./table.fix.types";

/**
 * 处理表格单元格内Backspace键的BR元素修复中间件
 *
 * 意图：当单元格内只有一个字符且前面是BR元素时，删除操作会导致BR丢失，
 *       需要在删除前补充一个BR以保持单元格结构完整
 * 调用时机：fixTable中间件链的第一个环节，仅在Backspace+空选区时生效
 *
 * @param ctx 表格修复上下文，包含range/event/controller等
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleBackspaceBrFix = (ctx: TableFixContext) => {
    const { range, event } = ctx;
    // Backspace键且选区为空时，检查是否需要修复BR结构
    if (event.key !== "Backspace" || range.toString() !== "") {
        return;
    }
    const previousElement = hasPreviousSibling(range.startContainer);
    // 前一个兄弟节点必须是BR元素节点，且当前文本只有一个字符，且没有后续兄弟
    if (!(previousElement instanceof Element)) {
        return;
    }
    if (range.startOffset !== 1
        || previousElement.tagName !== "BR"
        || range.startContainer.textContent?.length !== 1
        || hasNextSibling(range.startContainer)) {
        return;
    }
    // 在BR前插入新BR，防止删除后单元格结构异常
    previousElement.insertAdjacentHTML("beforebegin", "<br>");
};

/**
 * 处理表格单元格内Shift+Enter软换行中间件
 *
 * 意图：在表格单元格内按Shift+Enter时插入BR实现软换行，而非创建新块
 * 调用时机：fixTable中间件链中，检测到Shift+Enter组合键时消费事件并abort
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleShiftEnter = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理Shift+Enter（无Ctrl无Alt）
    if (!(event.key === "Enter" && event.shiftKey && isNotCtrl(event) && !event.altKey)) {
        return;
    }
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const oldHTML = nodeElement.outerHTML;
    wbrElement.remove();
    // 确保单元格末尾有BR，防止软换行后光标位置异常
    if (!cellElement.innerHTML.endsWith("<br>")) {
        cellElement.insertAdjacentHTML("beforeend", "<br>");
    }
    range.extractContents();
    const toolbar = protyle.toolbar;
    // toolbar不存在时无法判断行内样式类型，跳过code特殊处理
    if (!toolbar) {
        range.insertNode(document.createElement("br"));
        range.collapse(false);
        finishShiftEnter(protyle, nodeElement, oldHTML, event, controller);
        return;
    }
    const types = toolbar.getCurrentType(range);
    // 代码行内样式中startContainer可能是元素节点，需要用after而非insertNode
    // https://github.com/siyuan-note/siyuan/issues/4169
    const isCodeInlineElement = types.includes("code")
        && range.startContainer.nodeType !== 3
        && range.startContainer instanceof HTMLElement;
    // 代码行内元素且startContainer为HTMLElement时，用after插入BR避免DOM结构异常
    if (isCodeInlineElement && range.startContainer instanceof HTMLElement) {
        const brElement = document.createElement("br");
        range.startContainer.after(brElement);
        range.setStartAfter(brElement);
    }
    // 非代码行内样式或文本节点时，直接插入BR
    if (!isCodeInlineElement) {
        range.insertNode(document.createElement("br"));
    }
    range.collapse(false);
    finishShiftEnter(protyle, nodeElement, oldHTML, event, controller);
};

/**
 * 完成软换行操作的收尾工作：滚动、提交事务、阻止默认行为并abort
 *
 * 意图：抽取shift+enter处理中的公共收尾逻辑，避免重复代码
 * 调用时机：handleShiftEnter内部的两个分支都需要执行此收尾
 *
 * @param protyle 编辑器实例
 * @param nodeElement 表格块级元素
 * @param oldHTML 修改前的HTML快照
 * @param event 键盘事件
 * @param controller 中止控制器
 * @同步豁免: 需要绝对同步的DOM访问
 */
const finishShiftEnter = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    oldHTML: string,
    event: KeyboardEvent,
    controller: AbortController,
) => {
    scrollCenter(protyle);
    updateTransaction(protyle, nodeElement, oldHTML);
    event.preventDefault();
    controller.abort("表格软换行");
};
