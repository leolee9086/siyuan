/** 删除列后同步清理同一数据库的全部可见实例和属性面板。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 事务登记后必须在 updated 回写前立即移除全部同源列。 */
export const removeAttrViewColPresentation = (blockElement: Element, id: string) => {
    const avID = blockElement.getAttribute("data-av-id");
    if (!avID) {
        for (const item of blockElement.querySelectorAll(`.av__cell[data-col-id="${id}"]`)) {
            item.remove();
        }
        return;
    }
    for (const item of document.querySelectorAll(`.av[data-av-id="${avID}"] .av__cell[data-col-id="${id}"]`)) {
        item.remove();
    }
    for (const item of document.querySelectorAll(`.custom-attr [data-av-id="${avID}"] > .av__row[data-col-id="${id}"]`)) {
        item.remove();
    }
};
