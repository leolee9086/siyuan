import {updateTransaction} from "../../wysiwyg/transaction/update";

/** 读取或切换表格的行、列表头状态。 */
export const isTableHeaderEnabled = (nodeElement: Element, type: "row" | "column") => {
    return type === "row" ? nodeElement.getAttribute("custom-sy-table-header-row") !== "false" :
        nodeElement.getAttribute("custom-sy-table-header-column") === "true";
};

/** 切换表格行或列的表头属性，并提交一次编辑事务。 */
export const toggleTableHeader = (protyle: IProtyle, nodeElement: Element, type: "row" | "column") => {
    const html = nodeElement.outerHTML;
    const attribute = `custom-sy-table-header-${type}`;
    if (isTableHeaderEnabled(nodeElement, type)) {
        if (type === "row") {
            nodeElement.setAttribute(attribute, "false");
        } else {
            nodeElement.removeAttribute(attribute);
        }
    } else if (type === "row") {
        nodeElement.removeAttribute(attribute);
    } else {
        nodeElement.setAttribute(attribute, "true");
    }
    updateTransaction(protyle, nodeElement, html);
};
