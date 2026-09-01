import {getAVEditFieldMenuItems} from "../editFieldMenu";
import {avContextmenu, deleteRow, isMobile, Menu, startCardCoverPosition} from "./imports";
import {consumeClickEvent} from "./shared";

export const handleSelectionEditClick = (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    event: MouseEvent,
) => {
    const menu = new Menu();
    for (const item of getAVEditFieldMenuItems(protyle, blockElement)) {
        menu.addItem(item);
    }
    if (isMobile) {
        menu.fullscreen();
        return consumeClickEvent(event);
    }
    const rect = target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom, w: rect.width, h: rect.height});
    return consumeClickEvent(event);
};

export const handleSelectionDeleteClick = (
    protyle: IProtyle,
    blockElement: HTMLElement,
    event: MouseEvent,
) => {
    deleteRow(blockElement, protyle);
    return consumeClickEvent(event);
};

export const handleSelectionMoreClick = (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    event: MouseEvent,
) => {
    const rect = target.getBoundingClientRect();
    avContextmenu(protyle, undefined, {
        x: rect.left,
        y: rect.bottom,
        w: rect.width,
        h: rect.height,
    }, {blockElement, anchorElement: target});
    return consumeClickEvent(event);
};

export const handleCoverPositionClick = (
    protyle: IProtyle,
    target: HTMLElement,
    event: MouseEvent,
) => {
    startCardCoverPosition(protyle, target);
    return consumeClickEvent(event);
};
