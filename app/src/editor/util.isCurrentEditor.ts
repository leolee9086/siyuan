import { Editor } from ".";
import { Tab } from "../layout/Tab";
import { getInstanceById } from "../layout/util";


export const isCurrentEditor = (blockId: string) => {
    const activeElements: Element[] = [];
    const classActiveElement = document.querySelector(".layout__wnd--active > .fn__flex > .layout-tab-bar > .item--focus");
    if (classActiveElement) {
        activeElements.push(classActiveElement);
    }
    const wndElement = document.activeElement?.closest('div[data-type="wnd"]');
    if (wndElement) {
        const activeTabElement = wndElement.querySelector(".layout-tab-bar > .item--focus");
        if (activeTabElement && !activeElements.includes(activeTabElement)) {
            activeElements.push(activeTabElement);
        }
    }
    if (activeElements.length === 0) {
        return false;
    }
    for (const activeElement of activeElements) {
        const tabDataID = activeElement.getAttribute("data-id");
        if (!tabDataID) {
            continue;
        }
        const tab = getInstanceById(tabDataID);
        if (tab instanceof Tab && tab.model instanceof Editor) {
            if (tab.model.editor.protyle.block.rootID === blockId ||
                tab.model.editor.protyle.block.parentID === blockId || // updateBacklinkGraph 时会传入 parentID
                tab.model.editor.protyle.block.id === blockId) {
                return true;
            }
        }
    }
    return false;
};
