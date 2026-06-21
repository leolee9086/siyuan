import { matchHotKey } from "../util/hotKey";
import { beforePaste, pasteAsPlainText } from "../util/paste";

export const pasteAsPlainTextMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey("⇧⌘V", event)) {
        event.returnValue = false;
        event.preventDefault();
        event.stopPropagation();
        beforePaste(protyle, nodeElement);
        pasteAsPlainText(protyle);
        controller.abort("已黏贴纯文本");
        return;
    }
};
