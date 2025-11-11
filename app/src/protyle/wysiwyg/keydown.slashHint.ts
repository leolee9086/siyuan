import { Constants } from "../../constants";
import { hideElements } from "../ui/hideElements";
import { editorContext } from "./types";

export const hintSlashMiddleware = (
    ctx: editorContext
) => {
    const { event, protyle } = ctx
    // https://github.com/siyuan-note/siyuan/issues/2261

    if (!["⌘", "⇧", "⌥", "⌃"].includes(Constants.KEYCODELIST[event.keyCode])) {
        if (Constants.KEYCODELIST[event.keyCode] === "/" ||
            // 德语
            event.key === "/" ||
            // windows 中文
            (event.code === "Slash" && event.key === "Process" && event.keyCode === 229)) {
            protyle.hint && (protyle.hint.enableSlash = true)
        } else if (Constants.KEYCODELIST[event.keyCode] === "\\" ||
            // 德语
            event.key === "\\" ||
            // Mac 日文-罗马字 https://github.com/siyuan-note/siyuan/issues/13725
            (event.key === "," && event.keyCode === 229) ||
            // windows 中文
            (event.code === "Backslash" && event.key === "Process" && event.keyCode === 229)) {
            protyle.hint && (protyle.hint.enableSlash = false)
            hideElements(["hint"], protyle);
            // 此处不能返回，否则无法撤销 https://github.com/siyuan-note/siyuan/issues/2795
        }
    }
}