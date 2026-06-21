import { matchHotKey } from "../util/hotKey";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isInEmbedBlock } from "../util/hasClosest";

/**
 * 处理表格创建
 * 当用户按下代码块快捷键时，将当前块转换为代码块
 */
export const handleTableBlockCreation = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!matchHotKey(getSiyuanConfig().keymap.editor.insert.table.custom, event) ||
        isInEmbedBlock(nodeElement)) {
        return;
    }
    if (!protyle.hint) {
        throw new Error("protyle缺少hint属性");
    }
    protyle.hint.splitChar = "/";
    protyle.hint.lastIndex = -1;
    protyle.hint.fill(`| ${Lute.Caret} |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`, protyle);
    event.preventDefault();
    event.stopPropagation();
    controller.abort("创建新的表格");
    return;
};
