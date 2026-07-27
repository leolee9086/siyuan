/** 删除列后的唯一同步 DOM 呈现。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 事务登记后必须在 updated 回写前立即移除当前列的全部单元格。 */
export const removeAttrViewColPresentation = (blockElement: Element, id: string) => {
    const columnCells = blockElement.querySelectorAll(`.av__cell[data-col-id="${id}"]`);
    for (const columnCell of columnCells) {
        columnCell.remove();
    }
};
