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
export const onWindowsMsg = (ipcData: IWebSocketData) => {
    switch (ipcData.cmd) {
        case "closetab":
            closeTab(ipcData);
            break;
        case "resetTabsStyle": {
            // data: addRegionStyle, rmDragStyle, rmDragStyleRegionStyle
            if (ipcData.data === "rmDragStyle") {
                document.querySelectorAll(".layout-tab-bars--drag").forEach(item => {
                    item.classList.remove("layout-tab-bars--drag");
                });
                document.querySelectorAll(".layout-tab-bar li[data-clone='true']").forEach(tabItem => {
                    tabItem.remove();
                });
                break;
            }
            if (!isWindow()) {
                break;
            }
            document.querySelectorAll<HTMLElement>(".layout-tab-bar--readonly .fn__flex-1").forEach(item => {
                const isTopMost = item.getBoundingClientRect().top <= 0;
                if (isTopMost && ipcData.data === "addRegionStyle") {
                    (item.style as CSSStyleDeclarationElectron).WebkitAppRegion = "drag";
                }
                if (isTopMost && ipcData.data === "removeRegionStyle") {
                    (item.style as CSSStyleDeclarationElectron).WebkitAppRegion = "";
                }
            });
            break;
        }
        case "lockscreen":
            exportLayout({
                errorExit: false,
                cb() {
                    fetchPost("/api/system/logoutAuth", {}, () => {
                        redirectToCheckAuth();
                    });
                }
            });
            break;
        case "lockscreenByMode":
            if (getSiyuanConfig().system.lockScreenMode === 1) {
                exportLayout({
                    errorExit: false,
                    cb() {
                        fetchPost("/api/system/logoutAuth", {}, () => {
                            redirectToCheckAuth();
                        });
                    }
                });
            }
            break;
    }
};
