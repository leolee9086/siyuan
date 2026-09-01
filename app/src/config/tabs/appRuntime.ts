import {fetchPost} from "../../util/network/fetch";
import {Constants} from "../../constants";
import {exportLayout} from "../../layout/export/exportLayout";
import {exitSiYuan} from "../../dialog/processSystem";
import {isElectron, isMobile} from "../../platform";
import {ipcSend} from "../../platform/electron/ipcRenderer";

/** 应用 / 关于 / 访问授权等 Tab 中的 system.* 设置项 save */
export const sendAppSetting = (controlId: string, value: unknown) => {
    switch (controlId) {
        case "system.autoLaunch2": {
            const autoLaunchMode = value as Config.ISystem["autoLaunch2"];
            fetchPost("/api/system/setAutoLaunch", {autoLaunch: autoLaunchMode}, () => {
                window.siyuan.config.system.autoLaunch2 = autoLaunchMode;
                if (isElectron) {
                    ipcSend(Constants.SIYUAN_AUTO_LAUNCH, {
                        openAtLogin: 0 !== autoLaunchMode,
                        openAsHidden: 2 === autoLaunchMode,
                    });
                }
            });
            break;
        }
        case "system.lockScreenMode": {
            const lockScreenMode = (value ? 1 : 0) as Config.ISystem["lockScreenMode"];
            fetchPost("/api/system/setFollowSystemLockScreen", {lockScreenMode}, () => {
                window.siyuan.config.system.lockScreenMode = lockScreenMode;
            });
            break;
        }
        case "system.networkServe": {
            const networkServe = Boolean(value) as Config.ISystem["networkServe"];
            fetchPost("/api/system/setNetworkServe", {networkServe}, () => {
                if (isMobile) {
                    void exitSiYuan();
                    return;
                }
                void exportLayout({
                    errorExit: true,
                    cb: exitSiYuan,
                });
            });
            break;
        }
        case "system.networkServeTLS": {
            const networkServeTLS = Boolean(value) as Config.ISystem["networkServeTLS"];
            fetchPost("/api/system/setNetworkServeTLS", {networkServeTLS}, () => {
                if (isMobile) {
                    void exitSiYuan();
                    return;
                }
                void exportLayout({
                    errorExit: true,
                    cb: exitSiYuan,
                });
            });
            break;
        }
        case "system.downloadInstallPkg": {
            const downloadInstallPkg = Boolean(value) as Config.ISystem["downloadInstallPkg"];
            fetchPost("/api/system/setDownloadInstallPkg", {downloadInstallPkg}, () => {
                window.siyuan.config.system.downloadInstallPkg = downloadInstallPkg;
            });
            break;
        }
        case "system.updateChannel": {
            const updateChannel = value as Config.TUpdateChannel;
            fetchPost("/api/system/setUpdateChannel", {updateChannel}, () => {
                window.siyuan.config.system.updateChannel = updateChannel;
            });
            break;
        }
        default:
            console.warn(`[config] sendAppSetting: unhandled controlId "${controlId}"`);
            break;
    }
};
