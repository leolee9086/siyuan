import {hasClosestByClassName} from "../util/hasClosest";
import {Constants} from "../../constants";
import {fetchPost} from "../../util/network/fetch";
import {onGet} from "../util/onGet";
import {hideTooltip} from "../runtime/dialog.port";

/**
 * 绑定 mousewheel 事件，处理动态加载和表格横向滚动。
 * @同步豁免: 遗留代码 - 从 WYSIWYG.bindEvent 中机械提取
 *
 * 在动态加载模式下，当用户滚动到编辑器顶部或底部时，自动请求加载更多块内容。
 * 同时处理表格横向滚动时清除选区的逻辑。
 *
 * @param protyle - 编辑器实例
 * @param element - wysiwyg DOM 元素
 */
export function bindScrollEvent(protyle: IProtyle, element: HTMLElement) {
    let preventGetTopHTML = false;
    // @内联回调
    element.addEventListener("mousewheel", (event: WheelEvent) => {
        hideTooltip();
        // https://ld246.com/article/1648865235549
        // 不能使用上一版本的 timeStamp，否则一直滚动将导致间隔不够 https://ld246.com/article/1662852664926
        if (!preventGetTopHTML && !protyle.scroll.element.classList.contains("fn__none")) {
            if (event.deltaY < 0 && protyle.wysiwyg.element.firstElementChild.getAttribute("data-eof") !== "1" &&
                (protyle.contentElement.clientHeight === protyle.contentElement.scrollHeight || protyle.contentElement.scrollTop === 0)) {
                fetchPost("/api/filetree/getDoc", {
                    id: protyle.wysiwyg.element.firstElementChild.getAttribute("data-node-id"),
                    mode: 1,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getResponse => {
                    preventGetTopHTML = false;
                    onGet({
                        data: getResponse,
                        protyle,
                        action: [Constants.CB_GET_BEFORE, Constants.CB_GET_UNCHANGEID],
                    });
                });
                preventGetTopHTML = true;
            } else if (event.deltaY > 0 && protyle.wysiwyg.element.lastElementChild.getAttribute("data-eof") !== "2" &&
                (protyle.contentElement.clientHeight === protyle.contentElement.scrollHeight ||
                    protyle.contentElement.clientHeight + Math.ceil(protyle.contentElement.scrollTop) >= protyle.contentElement.scrollHeight)) {
                fetchPost("/api/filetree/getDoc", {
                    id: protyle.wysiwyg.element.lastElementChild.getAttribute("data-node-id"),
                    mode: 2,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getResponse => {
                    preventGetTopHTML = false;
                    onGet({
                        data: getResponse,
                        protyle,
                        action: [Constants.CB_GET_APPEND, Constants.CB_GET_UNCHANGEID],
                    });
                });
                preventGetTopHTML = true;
            }
        }
        if (event.deltaX === 0) {
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/4099
        const tableElement = hasClosestByClassName(event.target as HTMLElement, "table");
        if (tableElement) {
            const tableSelectElement = tableElement.querySelector(".table__select") as HTMLElement;
            if (tableSelectElement?.style.width) {
                tableSelectElement.removeAttribute("style");
                window.siyuan.menus.menu.remove();
            }
        }
    }, {passive: true});
}
