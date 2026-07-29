import {fetchPost} from "../../util/network/fetch";
import { Constants } from "../../constants";
import type {LayoutTab} from "../../layout/layout.types";
/**
 * 
 * @param rootID 
 * @param tab 
 * @param protyle 
 */
export const updateTitle = (rootID: string, tab: LayoutTab, protyle?: IProtyle) => {
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
