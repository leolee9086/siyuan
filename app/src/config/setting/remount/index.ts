/** 用途：读取重挂载所需的搜索、Dialog、状态和注册表实现；使用范围：设置重挂载子域；解耦评估：网关逐项直达实现，不加载 tabs.ts。 */
import {Constants} from "./imports";
/** 用途：读取设置搜索过滤上下文；使用范围：重挂载时计算当前页签可见项；解耦评估：纯数据读取通过网关复用唯一实现。 */
import {getSearchKeywordsLower} from "./imports";
/** 用途：读取完整设置页签注册表；使用范围：重挂载时查找当前页签；解耦评估：注册表读取避免反向导入 tabs.ts。 */
import {getSForgeState} from "./imports";
/** 用途：读取设置页签注册表身份；使用范围：访问 SForge 状态槽；解耦评估：Symbol 保持跨模块状态唯一。 */
import {SETTING_TAB_REGISTRY} from "./imports";
/** 用途：设置页签标识；使用范围：重挂载入口参数；解耦评估：纯领域标识不加载设置装配实现。 */
import type {SettingTabId} from "../setting.types";
/** 用途：设置页签搜索上下文；使用范围：将搜索结果传回完整页签 mount；解耦评估：纯数据通过参数传递。 */
import type {SettingTabMountContext} from "../mount";

/** 外观配置变更后重挂载当前设置页签，保留搜索过滤和完整页签生命周期。 */
export const remountOpenSettingTab = async (tabId: SettingTabId) => {
    const dialogElement = window.siyuan.dialogs.find((d) => d.element.getAttribute("data-key") === Constants.DIALOG_SETTING)?.element;
    if (!dialogElement) {
        return;
    }
    const root = dialogElement.querySelector<HTMLElement>(`.config__tab-container[data-name="${tabId}"]`);
    if (!root?.innerHTML) {
        return;
    }
    const settingTabs = getSForgeState(SETTING_TAB_REGISTRY);
    if (!settingTabs) {
        throw new Error("Setting tab registry is not registered");
    }
    const tab = settingTabs.get(tabId);
    if (!tab) {
        throw new Error(`Setting tab is not registered: ${tabId}`);
    }
    const keywords = getSearchKeywordsLower(dialogElement);
    let search: Partial<SettingTabMountContext> = {};
    if (keywords) {
        const result = tab.scanSearch(keywords);
        search = {
            keywords,
            ...(result.visibleItemIds ? {visibleItemIds: result.visibleItemIds} : {}),
            ...(result.visibleGroupIds ? {visibleGroupIds: result.visibleGroupIds} : {}),
        };
    }
    await tab.mount(root, search, undefined, true);
};
