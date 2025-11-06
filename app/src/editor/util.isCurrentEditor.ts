import { Editor } from ".";
import { Tab } from "../layout/Tab";
import { getInstanceById } from "../layout/util";


export const isCurrentEditor = (blockId: string) => {
    const activeElement = document.querySelector(".layout__wnd--active > .fn__flex > .layout-tab-bar > .item--focus");
    if(!activeElement){
        return false 
    }
    const tabDataID = activeElement.getAttribute("data-id")
    if(!tabDataID){
        console.error(blockId,activeElement)
        throw new Error ("ui结构错误,缺少data-id")
    }
    if (activeElement) {
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
