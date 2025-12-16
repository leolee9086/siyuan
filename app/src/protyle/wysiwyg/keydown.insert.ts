import { insertEmptyBlock } from "../../block/util";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
import { matchHotKey } from "../util/hotKey";

export const insertBeforeMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertBefore.custom, event)) {
        // https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2846594701
        nodeElement.querySelector(".img--select")?.classList.remove("img--select");
        insertEmptyBlock(protyle, "beforebegin");
        event.preventDefault();
        controller.abort();
        return true;
    }
};


export const insertAfterMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertAfter.custom, event)) {
        // https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2846594701
        nodeElement.querySelector(".img--select")?.classList.remove("img--select");
        insertEmptyBlock(protyle, "afterend");
        event.preventDefault();
        controller.abort();
        return true;
    }
};

