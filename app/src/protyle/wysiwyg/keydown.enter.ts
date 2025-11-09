import { matchHotKey } from "../util/hotKey";
import { enter } from "./enter";

export const enterKeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    // 回车
    if (matchHotKey("↩", event)) {
        enter(nodeElement, range, protyle);
        event.stopPropagation();
        event.preventDefault();
        controller.abort("Enter键处理完成");
    }
};