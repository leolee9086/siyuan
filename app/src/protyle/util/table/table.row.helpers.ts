/**
 * 构建 insertRowAbove 所需的行 HTML 和合并标记
 *
 * 作用：遍历当前行的所有单元格，生成对应标签的空行 HTML，并检测是否存在合并单元格
 * 意图：从 insertRowAbove 提取的内部辅助，隔离行 HTML 构建逻辑
 * 调用时机：insertRowAbove 开始时调用
 *
 * @param parentEl - 当前行元素
 * @param tagName - 当前单元格的标签名（TH 或 TD）
 * @returns rowHTML 和 hasNone 标记
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 遍历DOM子元素读取属性构建HTML，必须与调用方insertRowAbove保持同步 */
export const buildRowAboveHTML = (parentEl: Element, tagName: string): { rowHTML: string; hasNone: boolean } => {
    let rowHTML = "";
    let hasNone = false;
    const tag = tagName === "TH" ? "th" : "td";
    for (let m = 0; m < parentEl.childElementCount; m++) {
        const child = parentEl.children[m];
        // fn__none 类名标记被合并单元格覆盖的占位单元格
        if (child instanceof HTMLTableCellElement && child.className === "fn__none") {
            hasNone = true;
        }
        // 不需要空格，否则列宽调整后在空格后插入图片会换行 https://github.com/siyuan-note/siyuan/issues/7631
        if (child instanceof HTMLTableCellElement) {
            rowHTML += `<${tag} class="${child.className}" colspan="${child.colSpan}" align="${child.getAttribute("align")}"></${tag}>`;
        }
    }
    return {rowHTML, hasNone};
};

/**
 * 调整合并单元格的 rowSpan 值
 *
 * 作用：在插入行前，遍历上方所有行，将跨越到当前行的合并单元格 rowSpan +1
 * 意图：从 insertRowAbove 提取的内部辅助，隔离 rowSpan 调整逻辑
 * 调用时机：insertRowAbove 检测到存在 fn__none 合并标记时调用
 *
 * @param parentEl - 当前行元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 遍历DOM兄弟行修改rowSpan属性，必须与调用方insertRowAbove保持同步 */
export const adjustRowSpanForInsert = (parentEl: Element) => {
    let previousTrElement = parentEl.previousElementSibling;
    let rowCount = 1;
    while (previousTrElement) {
        rowCount++;
        for (const cell of Array.from(previousTrElement.children)) {
            // 仅处理表格单元格元素
            if (!(cell instanceof HTMLTableCellElement)) {
                continue;
            }
            // 跨行数覆盖到当前行且确实是合并单元格时，扩展其 rowSpan
            if (cell.rowSpan >= rowCount && cell.rowSpan > 1) {
                cell.rowSpan = cell.rowSpan + 1;
            }
        }
        previousTrElement = previousTrElement.previousElementSibling;
    }
};

/**
 * 处理在 thead 第一行上方插入新行的特殊逻辑
 *
 * 作用：创建新 thead 容纳新行，将原 thead 内容降级为 tbody 行
 * 意图：从 insertRowAbove 提取的内部辅助，隔离 thead 边界处理
 * 调用时机：insertRowAbove 检测到当前行在 thead 且无前驱兄弟时调用
 *
 * @param grandParent - thead 元素
 * @param nodeElement - 表格块级节点
 * @param rowHTML - 新行 HTML
 * @param count - 插入行数
 * @returns 新插入的行元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 创建/移除thead并重组DOM结构，必须与调用方insertRowAbove保持同步 */
export const insertAboveInThead = (grandParent: Element, nodeElement: Element, rowHTML: string, count: number): HTMLTableRowElement | undefined => {
    grandParent.insertAdjacentHTML("beforebegin", `<thead><tr>${rowHTML}</tr></thead>`);
    const theadTr = nodeElement.querySelector("thead tr");
    const nextSection = grandParent.nextElementSibling;
    const tdContent = grandParent.innerHTML.replace(/<th/g, "<td").replace(/<\/th>/g, "</td>");
    // 将原 thead 内容降级为 td 并移入后续 section
    if (nextSection) {
        nextSection.insertAdjacentHTML("afterbegin", tdContent);
    }
    // 插入多行时，额外行需要以 td 形式追加到后续 section
    if (nextSection && count > 1) {
        nextSection.insertAdjacentHTML("afterbegin", `<tr>${rowHTML.replace(/<th/g, "<td").replace(/<\/th>/g, "</td>")}</tr>`.repeat(count - 1));
    }
    grandParent.remove();
    return theadTr instanceof HTMLTableRowElement ? theadTr : undefined;
};

/**
 * 替换行内指定标签为另一标签（th↔td 转换）
 *
 * 作用：将容器内所有指定标签元素替换为目标标签，保留 innerHTML
 * 意图：从 moveRowToUp/moveRowToDown 提取的共享辅助，消除重复的 th↔td 转换代码
 * 调用时机：行在 thead/tbody 之间移动时需要转换单元格标签
 *
 * @param container - 包含待替换标签的容器元素
 * @param fromTag - 源标签名（如 "th"）
 * @param toTag - 目标标签名（如 "td"）
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 替换DOM元素标签，必须与调用方swapRowUpToThead/swapRowDownToTbody保持同步 */
export const replaceTagInRow = (container: Element, fromTag: string, toTag: string) => {
    for (const item of Array.from(container.querySelectorAll(fromTag))) {
        const newElement = document.createElement(toTag);
        newElement.innerHTML = item.innerHTML;
        item.parentNode?.replaceChild(newElement, item);
    }
};

/**
 * tbody 首行上移与 thead 行交换
 *
 * 作用：将 tbody 首行提升为 thead 行，原 thead 行降级为 tbody 行
 * 意图：从 moveRowToUp 提取的内部辅助，隔离跨 section 行交换逻辑并消除嵌套 if
 * 调用时机：moveRowToUp 检测到当前行是 tbody 首行时调用
 *
 * @param rowElement - 当前行元素（tbody 首行）
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 跨section移动DOM行并转换标签，必须与调用方moveRowToUp保持同步 */
export const swapRowUpToThead = (rowElement: Element) => {
    const prevSection = rowElement.parentElement?.previousElementSibling;
    const headElement = prevSection?.firstElementChild;
    // 前驱 section 或其首行不存在时无法交换
    if (!prevSection || !headElement) {
        return;
    }
    replaceTagInRow(headElement, "th", "td");
    replaceTagInRow(rowElement, "td", "th");
    rowElement.after(headElement);
    prevSection.append(rowElement);
};

/**
 * thead 行下移与 tbody 首行交换
 *
 * 作用：将 thead 行降级为 tbody 行，原 tbody 首行提升为 thead 行
 * 意图：从 moveRowToDown 提取的内部辅助，隔离跨 section 行交换逻辑并消除嵌套 if
 * 调用时机：moveRowToDown 检测到当前行是 thead 末行时调用
 *
 * @param rowElement - 当前行元素（thead 行）
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 跨section移动DOM行并转换标签，必须与调用方moveRowToDown保持同步 */
export const swapRowDownToTbody = (rowElement: Element) => {
    const nextSection = rowElement.parentElement?.nextElementSibling;
    const firstRowElement = nextSection?.firstElementChild;
    // 后续 section 或其首行不存在时无法交换
    if (!nextSection || !firstRowElement) {
        return;
    }
    replaceTagInRow(firstRowElement, "td", "th");
    replaceTagInRow(rowElement, "th", "td");
    rowElement.after(firstRowElement);
    nextSection.insertAdjacentElement("afterbegin", rowElement);
};
