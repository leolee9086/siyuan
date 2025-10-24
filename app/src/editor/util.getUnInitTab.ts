import { Constants } from "../constants";
import { getAllTabs } from "../layout/getAll";
import { objEquals } from "../util/functions";

// 没有初始化的页签无法检测到
export const getUnInitTab = (options: IOpenFileOptions) => {
    return getAllTabs().find(item => {
        const initData = item.headElement?.getAttribute("data-initdata");
        if (initData) {
            const initObj = JSON.parse(initData);
            if (initObj.instance === "Editor" &&
                (initObj.rootId === options.rootID || initObj.blockId === options.rootID)) {
                initObj.blockId = options.id;
                initObj.mode = options.mode;
                if (options.zoomIn) {
                    initObj.action = [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS];
                } else {
                    initObj.action = options.action;
                }
                item.headElement.setAttribute("data-initdata", JSON.stringify(initObj));
                item.parent.switchTab(item.headElement);
                return true;
            } else if (initObj.instance === "Custom" && options.custom && objEquals(initObj.customModelData, options.custom.data)) {
                item.parent.switchTab(item.headElement);
                return true;
            }
        }
    });
};
