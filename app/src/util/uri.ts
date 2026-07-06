/** 用途：SiYuan URI 协议解析。使用范围：处理 siyuan:// 与 web+siyuan://。解耦评估：路径工具模块。 */
import {isSiYuanUriProtocol} from "./pathName";
/** 用途：SiYuan URI 信息解析。使用范围：提取块 ID、聚焦状态等。解耦评估：路径工具模块。 */
import {parseSiYuanUriInfo} from "./pathName";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：基础设施。 */
import {fetchPost} from "./fetch";
/** 用途：检查折叠状态。使用范围：URI 块处理前检查折叠。解耦评估：平台工具模块。 */
import {checkFold} from "./platform/noRelyPCFunction";
/** 用途：跨目录共享常量。使用范围：导航指令与 IPC 命令标识。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：打开自定义插件页签。使用范围：插件 URI 未匹配插件实例时。解耦评估：通过 imports.ts 转发。 */
import {openFile} from "./imports";
/** 用途：桌面端通过 ID 打开块。使用范围：桌面端 URI 块处理。解耦评估：通过 imports.ts 转发。 */
import {openFileById} from "./imports";
/** 用途：移动端通过 ID 打开块。使用范围：移动端 URI 块处理。解耦评估：通过 imports.ts 转发。 */
import {openMobileFileById} from "./imports";
/** 用途：运行时平台检测。使用范围：替代条件编译分支。解耦评估：通过 imports.ts 转发。 */
import {isElectron} from "./imports";
/** 用途：运行时移动端检测。使用范围：替代条件编译分支。解耦评估：通过 imports.ts 转发。 */
import {isMobile} from "./imports";
/** 用途：Electron IPC 发送。使用范围：块打开后前置窗口。解耦评估：通过 imports.ts 转发。 */
import {ipcSend} from "./imports";

import type {App} from "./imports";

const getSiYuanUriAction = (zoomIn: boolean, focus: boolean): TProtyleAction[] => {
    if (zoomIn || focus) {
        return [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL];
    }
    return [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
};

const openSiYuanUriBlock = (app: App, id: string, focus: boolean, zoomIn: boolean) => {
    const action = getSiYuanUriAction(zoomIn, focus);
    if (isMobile) {
        openMobileFileById(app, id, action);
        return;
    }
    openFileById({
        app,
        id,
        action,
        zoomIn: zoomIn || focus,
    });
};

const processSiYuanUriBlocks = (app: App, uriObj: URL): boolean => {
    const blockInfo = parseSiYuanUriInfo(uriObj);
    if (blockInfo === null) {
        return false;
    }
    const {id, focus} = blockInfo;
    window.siyuan.editorIsFullscreen = blockInfo.fullscreen;
    // @内联回调
    fetchPost("/api/block/checkBlockExist", {id}, (existResponse) => {
        if (existResponse.data) {
            checkFold(id, (zoomIn) => {
                openSiYuanUriBlock(app, id, focus, zoomIn);
            });
            sendShowCommand();
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

const openPluginCustomTab = (app: App, uriObj: URL, pluginNameOrTabType: string) => {
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

const processSiYuanUriPlugins = (app: App, uriObj: URL): boolean => {
    const pluginNameOrTabType = parsePluginNameOrTabType(uriObj);
    if (!pluginNameOrTabType) {
        return false;
    }

    const plugin = app.plugins.find((item) => pluginNameOrTabType === item.name);
    if (plugin) {
        // siyuan://plugins/plugin-name/foo?bar=baz
        plugin.eventBus.emit("open-siyuan-url-plugin", {url: uriObj.href});
        return true;
    }
    openPluginCustomTab(app, uriObj, pluginNameOrTabType);
    return true;
};

const processSiYuanUriBazaar = (app: App, uriObj: URL): boolean => {
    if (isMobile) {
        return false;
    }
    const [, _type, _name, target] = uriObj.pathname.split("/");
    if (!_type || !_name) {
        return false;
    }
    if (_type !== "templates" && _type !== "icons" && _type !== "widgets" && _type !== "themes" && _type !== "plugins") {
        return false;
    }
    let resourceName: string;
    try {
        resourceName = decodeURIComponent(_name);
    } catch {
        return false;
    }
    if (target === "readme") {
        // siyuan://bazaar/plugins/plugin-sample/readme
        (async () => {
            const {openBazaarReadme} = await import("../config");
            openBazaarReadme(app, _type, resourceName);
        })();
        return true;
    }
    return false;
};

const sendShowCommand = () => {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, "show");
    }
};

export const processSiYuanUri = (app: App, uri: string) => {
    let uriObj: URL;
    try {
        uriObj = new URL(uri);
        if (!isSiYuanUriProtocol(uriObj)) {
            return false;
        }
    } catch (error) {
        return false;
    }
    const uriProcessors: Record<string, (app: App, uriObj: URL) => boolean> = {
        blocks: processSiYuanUriBlocks,
        plugins: processSiYuanUriPlugins,
        bazaar: processSiYuanUriBazaar,
    };
    const processor = uriProcessors[uriObj.hostname];
    if (processor) {
        return processor(app, uriObj);
    }
    return false;
};
