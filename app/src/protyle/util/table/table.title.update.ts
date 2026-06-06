import { Dialog } from "../../../dialog";
import { isMobile } from "../../../util/platform/functions";
import { getSiyuanLanguages } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { updateTransaction } from "../../wysiwyg/transaction";

/**
 * 构建表格标题编辑对话框的HTML内容
 *
 * 作用：生成包含标题输入框和位置选择器的对话框HTML
 * 意图：将HTML模板构建逻辑从主函数中分离，降低主函数复杂度
 * 调用时机：updateTableTitle 内部调用
 *
 * @param captionElement - 当前表格的 caption 元素，可能为 null
 * @returns 对话框内容HTML字符串
 * @同步豁免: UI构建
 */
export const buildDialogContent = (captionElement: HTMLTableCaptionElement | null): string => {
    const languages = getSiyuanLanguages();
    const isBottom = captionElement?.style.captionSide === "bottom";
    return `<div class="b3-dialog__content">
    <label>
        <div>${languages.title}</div>
        <div class="fn__hr"></div>
        <input class="b3-text-field fn__block">
    </label>
    <div class="fn__hr--b"></div>
    <label>
        <div>${languages.position}</div>
        <div class="fn__hr"></div>
        <select class="b3-select fn__block">
            <option value="top">${languages.up}</option>
            <option value="bottom" ${isBottom ? "selected" : ""}>${languages.down}</option>
        </select>
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${languages.confirm}</button>
</div>
<div>`;
};

/**
 * 处理表格标题确认操作
 *
 * 作用：根据用户输入更新或移除表格的 caption 元素，并提交事务
 * 意图：将确认按钮的回调逻辑提取为独立函数，消除内联回调和嵌套if
 * 调用时机：用户点击对话框确认按钮时
 *
 * @param protyle - 编辑器实例
 * @param nodeElement - 表格所在的块元素
 * @param captionElement - 当前的 caption 元素，可能为 null
 * @param inputElement - 标题输入框
 * @param selectElement - 位置选择器
 * @param dialog - 对话框实例
 * @param originalHTML - 修改前的节点HTML，用于事务回滚
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleTitleConfirm = (
    protyle: IProtyle,
    nodeElement: Element,
    captionElement: HTMLTableCaptionElement | null,
    inputElement: HTMLInputElement,
    selectElement: HTMLSelectElement,
    dialog: Dialog,
    originalHTML: string,
): void => {
    const title = inputElement.value.trim();
    const location = selectElement.value;
    const captionHTML = title
        ? `<caption contenteditable="false" ${location === "bottom" ? 'style="caption-side: bottom;"' : ""}>${Lute.EscapeHTMLStr(title)}</caption>`
        : "";
    const tableEl = nodeElement.querySelector("table");
    // 用户输入了标题但caption和table都不存在：无法操作
    if (title && !captionElement && !tableEl) {
        dialog.destroy();
        return;
    }
    // 用户输入了标题且caption已存在：直接替换outerHTML
    if (title && captionElement) {
        captionElement.outerHTML = captionHTML;
    }
    // 用户输入了标题且caption不存在：在table开头插入
    if (title && !captionElement && tableEl) {
        tableEl.insertAdjacentHTML("afterbegin", captionHTML);
    }
    // 用户输入了标题：设置caption属性
    if (title) {
        nodeElement.setAttribute("caption", Lute.EscapeHTMLStr(captionHTML));
    }
    // 用户清空了标题且caption存在：移除DOM节点
    if (!title && captionElement) {
        captionElement.remove();
    }
    // 用户清空了标题：移除caption属性
    if (!title) {
        nodeElement.removeAttribute("caption");
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // data-node-id 不存在时无法提交事务
    if (!nodeId) {
        dialog.destroy();
        return;
    }
    updateTransaction(protyle, nodeId, nodeElement.outerHTML, originalHTML);
    dialog.destroy();
};

/**
 * 打开表格标题编辑对话框
 *
 * 作用：弹出对话框让用户编辑表格的标题（caption）文本和位置
 * 意图：为表格提供标题编辑能力，支持设置标题文本和显示位置（上方/下方）
 * 调用时机：用户在表格右键菜单中选择"编辑标题"时调用
 *
 * @param protyle - 编辑器实例
 * @param nodeElement - 表格所在的块元素
 * @同步豁免: UI构建
 */
export const updateTableTitle = (protyle: IProtyle, nodeElement: Element): void => {
    const captionElement = nodeElement.querySelector("caption");
    getSiyuanGlobalMenusMenu().remove();
    const languages = getSiyuanLanguages();
    const dialog = new Dialog({
        title: languages.table,
        width: isMobile() ? "92vw" : "520px",
        content: buildDialogContent(captionElement),
    });
    const originalHTML = nodeElement.outerHTML;
    const inputElement = dialog.element.querySelector(".b3-text-field");
    // 输入框元素不存在时无法继续
    if (!(inputElement instanceof HTMLInputElement)) {
        return;
    }
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const cancelBtn = btnsElement[0];
    const confirmBtn = btnsElement[1];
    // 按钮元素不存在时无法继续
    if (!cancelBtn || !confirmBtn) {
        return;
    }
    const selectElement = dialog.element.querySelector("select");
    // 选择器元素不存在时无法继续
    if (!(selectElement instanceof HTMLSelectElement)) {
        return;
    }
    // @内联回调
    dialog.bindInput(inputElement, () => {
        // 确认按钮存在时模拟点击
        if (confirmBtn instanceof HTMLButtonElement) {
            confirmBtn.click();
        }
    });
    cancelBtn.addEventListener("click", () => {
        dialog.destroy();
    });
    confirmBtn.addEventListener("click", () => {
        handleTitleConfirm(protyle, nodeElement, captionElement, inputElement, selectElement, dialog, originalHTML);
    });
    inputElement.value = captionElement?.textContent || "";
    inputElement.focus();
    inputElement.select();
};
