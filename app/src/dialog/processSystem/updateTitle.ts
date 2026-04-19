import { fetchPost } from "../../card/imports";
import { Constants } from "../../constants";
import { Tab } from "../../window/imports";
/**
 * 
 * @param rootID 
 * @param tab 
 * @param protyle 
 */
export const updateTitle = (rootID: string, tab: Tab, protyle?: IProtyle) => {
    fetchPost("/api/block/getDocInfo", {
        id: rootID
    }, (response) => {
        //更新tab标题
        tab.updateTitle(response.data.name);
        if (protyle && protyle.title) {
            protyle.title.setTitle(response.data.name, response.data.ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true");
        }
    });
};
