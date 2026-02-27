/**
 * 更新列表项顺序
 * @param listElement 列表元素
 * @param sIndex 起始索引
 */


export const updateListOrder = (listElement: Element, sIndex?: number) => {
    if (listElement.getAttribute("data-subtype") !== "o") {
        return;
    }
    let starIndex: number;
    Array.from(listElement.children).forEach((item, index) => {
        // https://github.com/siyuan-note/siyuan/issues/16315 第三点会有为空的情况
        if (!item.classList.contains("li")) {
            return;
        }
        if (index === 0) {
            if (sIndex) {
                starIndex = sIndex;
                item.setAttribute("data-marker", (starIndex) + ".");
                item.querySelector(".protyle-action--order").textContent = (starIndex) + ".";
            } else {
                starIndex = parseInt(item.getAttribute("data-marker") || "1");
            }
        } else if (item.classList.contains("li")) {
            // 保证列表项的缩放和常规列表属性的存在
            starIndex++;
            item.setAttribute("data-marker", (starIndex) + ".");
            const orderItem = item.querySelector(".protyle-action--order");
            if (orderItem) {
                orderItem.textContent = (starIndex) + ".";
            }
        }
    });
};
