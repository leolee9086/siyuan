import { hasClosestBlock } from "../util/hasClosest";
import { focusBlock } from "../util/selection";
import { Constants } from "../../constants";
import { isNotCtrl } from "../util/compatibility";

export const pageNavigationMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 向上/下滚动一屏
    if (!event.altKey && !event.shiftKey && isNotCtrl(event) && (event.key === "PageUp" || event.key === "PageDown")) {
        if (!protyle.contentElement || !protyle.scroll) {
            return;
        }
        
        if (event.key === "PageUp") {
            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop - protyle.contentElement.clientHeight + 60;
            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
        } else {
            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + protyle.contentElement.clientHeight - 60;
            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
        }
        const contentRect = protyle.contentElement.getBoundingClientRect();
        let centerElement = document.elementFromPoint(contentRect.x + contentRect.width / 2, contentRect.y + contentRect.height / 2);
        
        if (centerElement && centerElement.classList.contains("protyle-wysiwyg")) {
            centerElement = document.elementFromPoint(contentRect.x + contentRect.width / 2, contentRect.y + contentRect.height / 2 + Constants.SIZE_TOOLBAR_HEIGHT);
        }
        
        if (centerElement) {
            const centerBlockElement = hasClosestBlock(centerElement);
            if (centerBlockElement && centerBlockElement !== nodeElement) {
                focusBlock(centerBlockElement, undefined, false);
            }
        }
        
        event.stopPropagation();
        event.preventDefault();
        controller.abort("页面导航处理完成");
    }
};