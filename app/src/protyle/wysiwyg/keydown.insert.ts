import { insertEmptyBlock } from "../../block/util";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isInEmbedBlock } from "../util/hasClosest";
import { matchHotKey } from "../util/hotKey";

export const insertBeforeMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertBefore.custom, event) &&
        !isInEmbedBlock(nodeElement)) {
        // https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2846594701
        nodeElement.querySelector(".img--select")?.classList.remove("img--select");
        insertEmptyBlock(protyle, "beforebegin");
        event.preventDefault();
        controller.abort("在当前块前插入空块");
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
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertAfter.custom, event) &&
        !isInEmbedBlock(nodeElement)) {
        // https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2846594701
        nodeElement.querySelector(".img--select")?.classList.remove("img--select");
        insertEmptyBlock(protyle, "afterend");
        event.preventDefault();
        controller.abort("在当前块后插入空块");
        return true;
    }
};

