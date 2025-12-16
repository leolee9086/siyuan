import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { matchHotKey } from "../util/hotKey";
import { moveToDown, moveToUp } from "./move";

export const moveToUpMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.moveToUp.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        moveToUp(protyle, nodeElement, range);
        controller.abort("向上移动");
        return;
    }
};


export const moveToDownMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.moveToDown.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        moveToDown(protyle, nodeElement, range);
        controller.abort("向下移动");
        return;
    }
};