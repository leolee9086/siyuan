/** 用途：SiYuan URI 协议解析。使用范围：处理 siyuan:// 与 web+siyuan://。解耦评估：路径工具模块。 */
import {isSiYuanUriProtocol} from "./uri/protocol";
/** 用途：SiYuan URI 信息解析。使用范围：提取块 ID、聚焦状态等。解耦评估：路径工具模块。 */
import {parseSiYuanUriInfo} from "./uri/protocol";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：基础设施。 */
import {fetchPost} from "./network/fetch";
/** 用途：检查折叠状态。使用范围：URI 块处理前检查折叠。解耦评估：平台工具模块。 */
import {checkFold} from "../block/fold/checkFold";
import {isValidBazaarPackageName} from "./bazaarPackage";
import {isBazaarAvailable} from "./bazaarAvailability";
import {openBazaarReadme} from "../config/bazzar/readme/openReadme";
/** 用途：应用常量。使用范围：导航指令与 IPC 命令标识。 */
import {Constants} from "../constants";
/** 用途：运行时平台检测。使用范围：URI 宿主分支。 */
import {isElectron, isMobile} from "../platform";
/** 用途：Electron IPC 发送。使用范围：块打开后前置窗口。 */
import {ipcSend} from "../platform/electron/ipcRenderer";
/** 用途：数据库项目 URI 定位。使用范围：打开文档前排队，打开后激活。 */
import {activateQueuedAVLocate, queueAVLocateRequest} from "../protyle/render/av/locate/activation/activation";
/** 用途：数据库根渲染。使用范围：URI 定位激活参数。 */
import {avRender} from "../protyle/render/av/render";

import type { AppFacade } from "../app/AppFacade.types";

/** 从完整 AppFacade 编辑器集合中定位 URI 对应的 Protyle，覆盖桌面和移动宿主。 */
const findOpenProtyle = (app: AppFacade, blockID: string) => {
    for (const editor of app.getOpenEditors()) {
        const protyle = editor.protyle;
        if (protyle.block.id === blockID || protyle.block.rootID === blockID ||
            protyle.element.querySelector(`[data-node-id="${blockID}"]`)) {
            return protyle;
        }
    }
    return undefined;
};

const getSiYuanUriAction = (zoomIn: boolean, focus: boolean, locateAV: boolean): TProtyleAction[] => {
    if (locateAV) {
        return [Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
    }
    if (zoomIn || focus) {
        return [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL];
    }
    return [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
};

const openSiYuanUriBlock = (app: AppFacade, blockInfo: NonNullable<ReturnType<typeof parseSiYuanUriInfo>>, zoomIn: boolean) => {
    const {id, focus, avItemID} = blockInfo;
    const action = getSiYuanUriAction(zoomIn, focus, Boolean(avItemID));
    if (!avItemID) {
        app.openBlock({id, action, zoomIn: zoomIn || focus});
        return;
    }
    // 确认块存在并解析折叠状态后才登记数据库定位请求，不存在的块不占用导航状态。
    queueAVLocateRequest(id, {
        itemID: avItemID,
        ...(blockInfo.avViewID ? {viewID: blockInfo.avViewID} : {}),
        ...(blockInfo.avGroupID ? {groupID: blockInfo.avGroupID} : {}),
    });
    app.openBlock({
        id,
        action,
        zoomIn: false,
        afterOpen: () => {
            const protyle = findOpenProtyle(app, id);
            if (protyle) {
                activateQueuedAVLocate({renderAV: avRender, protyle, blockID: id});
            }
        },
    });
};

const processSiYuanUriBlocks = (app: AppFacade, uriObj: URL): boolean => {
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
                openSiYuanUriBlock(app, blockInfo, zoomIn);
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
    let icon = uriObj.searchParams.get("icon");
    // 页签图标进入 SVG use 引用前只接受图标标识符，阻断 URI 注入标记或路径。
    if (icon && !/^[a-zA-Z0-9]+$/.test(icon)) {
        icon = null;
    }
    app.openTab({
        custom: {
            title: uriObj.searchParams.get("title") ?? pluginNameOrTabType,
            icon: icon ?? "iconPlugin",
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
        // siyuan://plugins/plugin-name/foo?bar=baz
        plugin.eventBus.emit("open-siyuan-url-plugin", {url: uriObj.href});
        return true;
    }
    if (!app.plugins.some((item) => item.models[pluginNameOrTabType])) {
        return false;
    }
    openPluginCustomTab(app, uriObj, pluginNameOrTabType);
    return true;
};

const processSiYuanUriBazaar = (app: AppFacade, uriObj: URL): boolean => {
    // 上游改进：集市入口除移动端外还受 disabledFeatures 开关控制
    if (!isBazaarAvailable()) {
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
    if (!isValidBazaarPackageName(resourceName)) {
        return false;
    }
    if (target !== "readme" && target !== "readme-installed") {
        return false;
    }
    // siyuan://bazaar/plugins/plugin-sample/readme[-installed]
    const from = target === "readme-installed" ? "downloaded" : "bazaar";
    void openBazaarReadme({app, bazaarType: _type, itemName: resourceName, from});
    return true;
};

const sendShowCommand = () => {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, "show");
    }
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
    const uriProcessors: Record<string, (app: AppFacade, uriObj: URL) => boolean> = {
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
