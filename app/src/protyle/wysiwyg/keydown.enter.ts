import { matchHotKey } from "../util/hotKey";
import { enter, softEnter } from "./enter";
import { editorContext } from "./types";

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

export const softEnterMiddleware = (
    ctx: editorContext
) => {
    const { event, range, controller,nodeElement, protyle } = ctx;
    const selectText = range.toString();
    if (matchHotKey("⇧↩", event) && selectText === "" && softEnter(range, nodeElement, protyle)) {
        event.stopPropagation();
        event.preventDefault();
        controller.abort("软换行");
        return;
    }
};
