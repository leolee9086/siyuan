import { getDockByType } from "../../layout/tabUtil";
import { isMobile } from "../../util/platform/functions";

export const getModelByDockType = (type: TDock | string) => {
    // 移动端从mobile.docks获取模型，桌面端从dock布局获取
    if (isMobile()) {
        return window.siyuan.mobile.docks[type];
    }
    return getDockByType(type).data[type];
};
