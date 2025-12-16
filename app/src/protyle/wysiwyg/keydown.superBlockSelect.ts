import { isMac, isNotCtrl, isOnlyMeta } from "../util/compatibility";
import { hasTopClosestByAttribute } from "../util/hasClosest";

/**
 * 处理超级块内的Shift+Home/End键选择功能
 * @param event 
 * @param protyle 
 * @param nodeElement 
 * @param range 
 * @param controller 
 */
export const superBlockSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    /**
     * 超级块和其它容器块都有可能在其它块的DOM内部
     */
    const topElement = hasTopClosestByAttribute(nodeElement, "data-node-id", null);
    if ((event.shiftKey && !event.altKey && isNotCtrl(event) && (event.key === "Home" || event.key === "End") && isMac()) ||
        (event.shiftKey && !event.altKey && isOnlyMeta(event) && (event.key === "Home" || event.key === "End") && !isMac())) {
        if (topElement) {
            // 超级块内已选中某个块
            topElement.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
                item.classList.remove("protyle-wysiwyg--select");
            });
            topElement.classList.add("protyle-wysiwyg--select");
            let nextElement = event.key === "Home" ? topElement.previousElementSibling : topElement.nextElementSibling;
            while (nextElement) {
                nextElement.classList.add("protyle-wysiwyg--select");
                nextElement = event.key === "Home" ? nextElement.previousElementSibling : nextElement.nextElementSibling;
            }
            if (event.key === "Home") {
                protyle.wysiwyg.element.firstElementChild.scrollIntoView();
            } else {
                protyle.wysiwyg.element.lastElementChild.scrollIntoView(false);
            }
        }
        event.stopPropagation();
        event.preventDefault();
        controller.abort("超级块选择处理完成");
    }
};