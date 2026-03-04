import { getInstanceById } from "../layout/util";
import { Tab } from "../layout/Tab";
import { isWindow } from "../util/platform/functions";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { lockScreen } from "../dialog/processSystem";
import { isElectronStyle } from "./setHeader.guard";
import type { App } from "../index";

const closeTab = (ipcData: IWebSocketData) => {
    const tab = getInstanceById(ipcData.data);
    if (!tab || !(tab instanceof Tab)) {
        return;
    }
    tab.parent.removeTab(ipcData.data);
};

const handleResetTabsStyle = (ipcData: IWebSocketData) => {
    if (ipcData.data === "rmDragStyle") {
        for (const item of document.querySelectorAll(".layout-tab-bars--drag")) {
            item.classList.remove("layout-tab-bars--drag");
        }
        for (const tabItem of document.querySelectorAll(".layout-tab-bar li[data-clone='true']")) {
            tabItem.remove();
        }
        return;
    }

    if (!isWindow()) {
        return;
    }

    for (const item of document.querySelectorAll<HTMLElement>(".layout-tab-bar--readonly .fn__flex-1")) {
        const isTopMost = item.getBoundingClientRect().top <= 0;
        if (!isTopMost || !isElectronStyle(item.style)) {
            continue;
        }
        if (ipcData.data === "addRegionStyle") {
            item.style.WebkitAppRegion = "drag";
        }
        if (ipcData.data === "removeRegionStyle") {
            item.style.WebkitAppRegion = "";
        }
    }
};

export const onWindowsMsg = (ipcData: IWebSocketData, app: App) => {
    if (!ipcData.cmd) {
        return;
    }

    switch (ipcData.cmd) {
        case "closetab":
            closeTab(ipcData);
            break;
        case "resetTabsStyle":
            handleResetTabsStyle(ipcData);
            break;
        case "lockscreen":
            lockScreen(app);
            break;
        case "lockscreenByMode":
            if (getSiyuanConfig().system.lockScreenMode === 1) {
                lockScreen(app);
            }
            break;
    }
};
