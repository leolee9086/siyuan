import { hasClosestBlock } from "../util/hasClosest";
import { matchHotKey } from "../util/hotKey";

export const crossBlockCopyMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!matchHotKey("⌘C", event) && event.key !== "Escape") {
        // https://ld246.com/article/1694506408293
        const endElement = hasClosestBlock(range.endContainer);
        if (endElement && nodeElement !== endElement) {
            event.stopPropagation();
            event.preventDefault();
            controller.abort("跨块选择被阻止,只允许跨块复制");
        }
    }
};
