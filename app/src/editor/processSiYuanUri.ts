/** 用途：系统常量。使用范围：打开块时指定定位动作。解耦评估：跨模块共享契约。 */
import {Constants} from "../constants";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：基础设施。 */
import {fetchPost} from "../util/network/fetch";
/** 用途：SiYuan URI 解析。使用范围：处理 siyuan:// 与 web+siyuan://。解耦评估：路径工具模块。 */
import {isSiYuanUriProtocol, parseSiYuanUriInfo} from "../util/pathName";
/** 用途：运行时平台判断。使用范围：替代移动端和 Electron 条件编译。解耦评估：平台基础设施。 */
import {isElectron, isMobile} from "../platform";
/** 用途：Electron IPC。使用范围：块打开后前置窗口。解耦评估：通过本地封装替代 electron 直连。 */
import {ipcSend} from "../platform/electron/ipcRenderer";
/** 用途：桌面端打开块。使用范围：桌面端处理块 URI。解耦评估：同目录编辑器能力。 */
import {openFileById} from "./utils.openFileById";
/** 用途：打开自定义插件页签。使用范围：插件 URI 未匹配插件实例时。解耦评估：同目录编辑器能力。 */
import {openFile} from "./openFile";
/** 用途：完整应用外观。使用范围：URI 块与插件分发。解耦评估：直接依赖应用领域根，不经 Editor 聚合网关反向加载布局实现。 */
import type {AppFacade} from "../app/AppFacade.types";

const getSiYuanUriAction = (zoomIn: boolean, focus: boolean) => {
    if (zoomIn || focus) {
        return [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL];
    }
    return [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
};

const openSiYuanUriBlock = (app: AppFacade, id: string, focus: boolean, zoomIn: boolean) => {
    const action = getSiYuanUriAction(zoomIn, focus);
    if (isMobile) {
        void import("../mobile/editor").then(({openMobileFileById}) => {
            openMobileFileById(app, id, action);
        });
        return;
    }
    openFileById({
        app,
        id,
        action,
        zoomIn: zoomIn || focus,
    });
};

const checkSiYuanUriFold = (id: string, cb: (zoomIn: boolean) => void) => {
    fetchPost("/api/block/checkBlockFold", {id}, (foldResponse) => {
        cb(foldResponse.data.isFolded);
    });
};

const processSiYuanUriBlocks = (app: AppFacade, uriObj: URL): boolean => {
    const blockInfo = parseSiYuanUriInfo(uriObj);
    if (blockInfo === null) {
        return false;
    }
    const {id, focus} = blockInfo;
    window.siyuan.editorIsFullscreen = blockInfo.fullscreen;
    fetchPost("/api/block/checkBlockExist", {id}, (existResponse) => {
        if (existResponse.data) {
            checkSiYuanUriFold(id, (zoomIn) => {
                openSiYuanUriBlock(app, id, focus, zoomIn);
            });
            if (isElectron) {
                ipcSend(Constants.SIYUAN_CMD, "show");
            }
        }
        for (const plugin of app.plugins) {
            plugin.eventBus.emit("open-siyuan-url-block", {
                url: uriObj.href,
                id,
                focus,
                exist: existResponse.data,
            });
        }
    });
    return true;
};

const parsePluginNameOrTabType = (uriObj: URL): string | null => {
    const name = uriObj.pathname.split("/")[1];
    if (!name) {
        return null;
    }
    try {
        return decodeURIComponent(name);
    } catch (error) {
        return null;
    }
};

const openPluginCustomTab = (app: AppFacade, uriObj: URL, pluginNameOrTabType: string) => {
    if (isMobile) {
        return;
    }
    const data = (() => {
        try {
            return JSON.parse(uriObj.searchParams.get("data") || "{}");
        } catch (e) {
            console.log("Error open plugin tab with protocol:", e);
            return undefined;
        }
    })();
    openFile({
        app,
        custom: {
            title: uriObj.searchParams.get("title") ?? pluginNameOrTabType,
            icon: uriObj.searchParams.get("icon") ?? "iconPlugin",
            data,
            id: pluginNameOrTabType,
        },
    });
};

const processSiYuanUriPlugins = (app: AppFacade, uriObj: URL): boolean => {
    const pluginNameOrTabType = parsePluginNameOrTabType(uriObj);
    if (!pluginNameOrTabType) {
        return false;
    }

    const plugin = app.plugins.find((item) => pluginNameOrTabType === item.name);
    if (plugin) {
        plugin.eventBus.emit("open-siyuan-url-plugin", {url: uriObj.href});
    } else {
        openPluginCustomTab(app, uriObj, pluginNameOrTabType);
    }
    return true;
};

export const processSiYuanUri = (app: AppFacade, uri: string) => {
    let uriObj: URL;
    try {
        uriObj = new URL(uri);
        if (!isSiYuanUriProtocol(uriObj)) {
            return false;
        }
    } catch (error) {
        return false;
    }
    switch (uriObj.hostname) {
        case "blocks":
            return processSiYuanUriBlocks(app, uriObj);
        case "plugins":
            return processSiYuanUriPlugins(app, uriObj);
        default:
            break;
    }
    return false;
};

/** @deprecated 使用 processSiYuanUri。保留旧导出以兼容本地未迁移调用。 */
export const processSYLink = processSiYuanUri;
