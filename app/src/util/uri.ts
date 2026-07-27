/** 用途：SiYuan URI 协议解析。使用范围：处理 siyuan:// 与 web+siyuan://。解耦评估：路径工具模块。 */
import {isSiYuanUriProtocol} from "./pathName";
/** 用途：SiYuan URI 信息解析。使用范围：提取块 ID、聚焦状态等。解耦评估：路径工具模块。 */
import {parseSiYuanUriInfo} from "./pathName";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：基础设施。 */
import {fetchPost} from "./fetch";
/** 用途：检查折叠状态。使用范围：URI 块处理前检查折叠。解耦评估：平台工具模块。 */
import {checkFold} from "../block/fold/checkFold";
import {isValidBazaarPackageName} from "./bazaarPackage";
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
/** 用途：数据库项目 URI 定位。使用范围：打开文档前排队，打开后激活。解耦评估：通过 imports.ts 转发。 */
import {activateQueuedAVLocate, queueAVLocateRequest} from "./imports";
/** 用途：数据库根渲染；使用范围：URI 定位激活参数；解耦评估：经本域网关直达唯一实现。 */
import {avRender} from "./imports";

import type { AppFacade } from "./imports";

/** 从 openFile 回调的布局模型读取编辑器 Protyle，避免依赖当前不精确的基础 Model 声明。 */
const getModelProtyle = (model?: object) => {
    if (!model || !("editor" in model)) {
        return undefined;
    }
    const editor = Reflect.get(model, "editor");
    if (!editor || typeof editor !== "object" || !("protyle" in editor)) {
        return undefined;
    }
    return Reflect.get(editor, "protyle");
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
    const locateAV = Boolean(avItemID);
    const action = getSiYuanUriAction(zoomIn, focus, locateAV);
    if (isMobile) {
        openMobileFileById(app, id, action, undefined, undefined,
            locateAV ? (protyle) => activateQueuedAVLocate({renderAV: avRender, protyle, blockID: id}) : undefined);
        return;
    }
    openFileById({
        app,
        id,
        action,
        zoomIn: locateAV ? false : zoomIn || focus,
        afterOpen: locateAV ? (model) => {
            const protyle = getModelProtyle(model);
            if (protyle) {
                activateQueuedAVLocate({renderAV: avRender, protyle, blockID: id});
            }
        } : undefined,
    });
};

const processSiYuanUriBlocks = (app: AppFacade, uriObj: URL): boolean => {
    const blockInfo = parseSiYuanUriInfo(uriObj);
    if (blockInfo === null) {
        return false;
    }
    const {id, focus} = blockInfo;
    if (blockInfo.avItemID) {
        queueAVLocateRequest(id, {
            itemID: blockInfo.avItemID,
            viewID: blockInfo.avViewID,
            groupID: blockInfo.avGroupID,
        });
    }
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
    openFile({
        app,
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
    if (!isValidBazaarPackageName(resourceName)) {
        return false;
    }
    if (target !== "readme" && target !== "readme-installed") {
        return false;
    }
    // siyuan://bazaar/plugins/plugin-sample/readme[-installed]
    const from = target === "readme-installed" ? "downloaded" : "bazaar";
    (async () => {
        const {openBazaarReadme} = await import("../config");
        await openBazaarReadme(app, _type, resourceName, from);
    })();
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
