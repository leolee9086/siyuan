/** 隐藏并清空所有 Protyle gutter；供综合面板清理和宿主拖拽生命周期复用。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽 mouseup 清理必须在后续位置保存和回调前同步完成。 */
export const hideAllGutters = () => {
    for (const item of document.querySelectorAll(".protyle-gutters")) {
        item.classList.add("fn__none");
        item.innerHTML = "";
    }
};
