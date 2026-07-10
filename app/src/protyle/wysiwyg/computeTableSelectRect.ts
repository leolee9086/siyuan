export function computeTableSelectRect(
    target: HTMLElement,
    moveTarget: HTMLElement | boolean,
    tableBlockElement: HTMLElement,
    protyle: IProtyle) {
    if (typeof moveTarget === "boolean") {
        return;
    }
    tableBlockElement.firstElementChild.style.webkitUserModify = "read-only";
    let width = target.offsetLeft + target.clientWidth - moveTarget.offsetLeft;
    let left = moveTarget.offsetLeft;
    if (target.offsetLeft === moveTarget.offsetLeft) {
        width = Math.max(target.clientWidth, moveTarget.clientWidth);
    } else if (target.offsetLeft < moveTarget.offsetLeft) {
        width = moveTarget.offsetLeft + moveTarget.clientWidth - target.offsetLeft;
        left = target.offsetLeft;
    }
    let height = target.offsetTop + target.clientHeight - moveTarget.offsetTop;
    let top = moveTarget.offsetTop;
    if (target.offsetTop === moveTarget.offsetTop) {
        height = Math.max(target.clientHeight, moveTarget.clientHeight);
    } else if (target.offsetTop < moveTarget.offsetTop) {
        height = moveTarget.offsetTop + moveTarget.clientHeight - target.offsetTop;
        top = target.offsetTop;
    }
    // https://github.com/siyuan-note/insider/issues/1015
    Array.from(tableBlockElement.querySelectorAll("th, td")).find((item: HTMLElement) => {
        const updateWidth = item.offsetLeft < left + width && item.offsetLeft + item.clientWidth > left + width;
        const updateWidth2 = item.offsetLeft < left && item.offsetLeft + item.clientWidth > left;
        if (item.offsetTop < top && item.offsetTop + item.clientHeight > top) {
            if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                height = top + height - item.offsetTop;
                top = item.offsetTop;
            }
            if (updateWidth) {
                width = item.offsetLeft + item.clientWidth - left;
            }
            if (updateWidth2) {
                width = left + width - item.offsetLeft;
                left = item.offsetLeft;
            }
        } else if (item.offsetTop < top + height && item.offsetTop + item.clientHeight > top + height) {
            if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                height = item.clientHeight + item.offsetTop - top;
            }
            if (updateWidth) {
                width = item.offsetLeft + item.clientWidth - left;
            }
            if (updateWidth2) {
                width = left + width - item.offsetLeft;
                left = item.offsetLeft;
            }
        } else if (updateWidth2 && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
            width = left + width - item.offsetLeft;
            left = item.offsetLeft;
        } else if (updateWidth && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
            width = item.offsetLeft + item.clientWidth - left;
        }
    });
    protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
    tableBlockElement.querySelector(".table__select").setAttribute("style", `left:${left - tableBlockElement.firstElementChild.scrollLeft}px;top:${top - tableBlockElement.querySelector("table").scrollTop}px;height:${height}px;width:${width + 1}px;`);
}
