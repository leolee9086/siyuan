import {getSearchKeywordsLower} from "../search/normalize";
import {Constants} from "../../constants";
import {getSettingTab, type TSettingTab} from "./tabs";
import type {SettingTabMountContext} from "./mount";

/** 设置面板已打开且对应 Tab 已挂载时，重新 register 并整页替换。 */
export const remountOpenSettingTab = async (tabId: TSettingTab) => {
    const dialogElement = window.siyuan.dialogs.find((d) => d.element.getAttribute("data-key") === Constants.DIALOG_SETTING)?.element;
    if (!dialogElement) {
        return;
    }
    const root = dialogElement.querySelector(`.config__tab-container[data-name="${tabId}"]`) as HTMLElement | null;
    if (!root?.innerHTML) {
        return;
    }
    const search: Partial<SettingTabMountContext> = {};
    const keywords = getSearchKeywordsLower(dialogElement);
    const tab = getSettingTab(tabId);
    if (keywords) {
        const result = tab.scanSearch(keywords);
        search.keywords = keywords;
        search.visibleItemIds = result.visibleItemIds;
        search.visibleGroupIds = result.visibleGroupIds;
    }
    await tab.mount(root, search, undefined, true);
};
