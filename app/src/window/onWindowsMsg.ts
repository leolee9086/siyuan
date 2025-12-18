import { exportLayout, getInstanceById } from "../layout/util";
import { Tab } from "../layout/Tab";
import { fetchPost } from "../util/fetch";
import { redirectToCheckAuth } from "../util/pathName";
import { isWindow } from "../util/functions";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";

const closeTab = (ipcData: IWebSocketData) => {
    const tab = getInstanceById(ipcData.data);
    if (tab && tab instanceof Tab) {
        tab.parent.removeTab(ipcData.data);
    }
};
const handleResetTabsStyle = (ipcData: IWebSocketData) => {
    // data: addRegionStyle, rmDragStyle, rmDragStyleRegionStyle
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
        if (isTopMost && ipcData.data === "addRegionStyle") {
            (item.style as CSSStyleDeclarationElectron).WebkitAppRegion = "drag";
        }
        if (isTopMost && ipcData.data === "removeRegionStyle") {
            (item.style as CSSStyleDeclarationElectron).WebkitAppRegion = "";
        }
    }
};

const handleLockscreen = () => {
    exportLayout({
        errorExit: false,
        cb() {
            fetchPost("/api/system/logoutAuth", {}, () => {
                redirectToCheckAuth();
            });
        }
    });
};

const handleLockscreenByMode = () => {
    if (getSiyuanConfig().system.lockScreenMode === 1) {
        handleLockscreen();
    }
};

const windowsMsgHandlers: Record<string, (ipcData: IWebSocketData) => void> = {
    closetab: closeTab,
    resetTabsStyle: handleResetTabsStyle,
    lockscreen: handleLockscreen,
    lockscreenByMode: handleLockscreenByMode,
};

export const onWindowsMsg = (ipcData: IWebSocketData) => {
    if (!ipcData.cmd) {
        return;
    }
    windowsMsgHandlers[ipcData.cmd]?.(ipcData);
};
