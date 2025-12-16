import { Constants } from "../../constants";
import { hideElements } from "../ui/hideElements";
import { isNotCtrl } from "../util/compatibility";
import { editorContext } from "./types";

export const hintSlashMiddleware = (
    ctx: editorContext
) => {
    const { event, protyle } = ctx;
    // https://github.com/siyuan-note/siyuan/issues/2261

    if (!["⌘", "⇧", "⌥", "⌃"].includes(Constants.KEYCODELIST[event.keyCode])) {
        if (Constants.KEYCODELIST[event.keyCode] === "/" ||
            // 德语
            event.key === "/" ||
            // windows 中文
            (event.code === "Slash" && event.key === "Process" && event.keyCode === 229)) {
            protyle.hint && (protyle.hint.enableSlash = true);
        } else if (Constants.KEYCODELIST[event.keyCode] === "\\" ||
            // 德语
            event.key === "\\" ||
            // Mac 日文-罗马字 https://github.com/siyuan-note/siyuan/issues/13725
            (event.key === "," && event.keyCode === 229) ||
            // windows 中文
            (event.code === "Backslash" && event.key === "Process" && event.keyCode === 229)) {
            protyle.hint && (protyle.hint.enableSlash = false);
            hideElements(["hint"], protyle);
            // 此处不能返回，否则无法撤销 https://github.com/siyuan-note/siyuan/issues/2795
        }
    }
};

export const hintNavigationMiddleware = (ctx: editorContext) => {
    const { event, protyle, controller } = ctx;
    if (
        !event.altKey &&
        !event.shiftKey &&
        (
            (event.key.indexOf("Arrow") > -1 && isNotCtrl(event)) ||
            event.key === "Enter") &&
        !protyle.hint.element.classList.contains("fn__none") &&
        protyle.hint.select(event, protyle)) {
        controller.abort("斜杠菜单导航");
    }
};


export const hideHintMiddleware = (ctx: editorContext) => {
    const { event, protyle } = ctx;
    // https://github.com/siyuan-note/siyuan/issues/11726
    if ((event.key === "Home" || event.key === "End") && !event.shiftKey && !event.altKey && isNotCtrl(event)) {
        hideElements(["hint"], protyle);
    }
};