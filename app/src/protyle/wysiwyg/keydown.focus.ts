import { onlyProtyleCommand } from "../../boot/globalEvent/command/protyle";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
import { matchHotKey } from "../util/hotKey";
export const 处理块进入聚焦 = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey(getSiyuanConfig().keymap.general.enter.custom, event)) {
        onlyProtyleCommand({
            protyle,
            command: "enter",
            previousRange: range,
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort();
    }
};


export const 处理块退出聚焦 = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {

    if (matchHotKey(getSiyuanConfig().keymap.general.enterBack.custom, event)) {
        onlyProtyleCommand({
            protyle,
            command: "enterBack",
            previousRange: range,
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort();
    }
};