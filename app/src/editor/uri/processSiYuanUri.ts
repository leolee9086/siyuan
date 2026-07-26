/** 用途：系统常量。使用范围：打开块时指定定位动作。解耦评估：跨模块共享契约。 */
import {Constants} from "./imports";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：基础设施。 */
import {fetchPost} from "./imports";
/** 用途：SiYuan URI 解析。使用范围：处理 siyuan:// 与 web+siyuan://。解耦评估：路径工具模块。 */
import {isSiYuanUriProtocol} from "./imports";
/** 用途：解析块 URI 信息。使用范围：块导航和请求上下文。解耦评估：通过 Editor 网关显式暴露父级依赖。 */
import {parseSiYuanUriInfo} from "./imports";
/** 用途：运行时平台判断。使用范围：保持 Electron 前置窗口与移动端插件页签行为。解耦评估：平台基础设施。 */
import {isElectron} from "./imports";
/** 用途：移动宿主判断。使用范围：禁止移动端创建插件自定义页签。解耦评估：通过 Editor 网关显式暴露父级依赖。 */
import {isMobile} from "./imports";
/** 用途：Electron IPC。使用范围：块打开后前置窗口。解耦评估：通过本地封装替代 electron 直连。 */
import {ipcSend} from "./imports";
/** 用途：打开自定义插件页签。使用范围：插件 URI 未匹配插件实例时。解耦评估：同目录编辑器能力。 */
import {openFile} from "./imports";
/** 用途：完整应用外观。使用范围：URI 块与插件分发。解耦评估：直接依赖应用领域根，不经 Editor 聚合网关反向加载布局实现。 */
import type {AppFacade} from "./imports";

/** 根据折叠和聚焦状态选择块导航动作；URI 块确认存在后用于保持原定位语义。 */
const getSiYuanUriAction = (zoomIn: boolean, focus: boolean) => {
    if (zoomIn || focus) {
        return [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL];
    }
    return [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
};

/** 将已解析的块 URI 交给当前完整 App 宿主打开；折叠检查完成后调用以保留平台差异。 */
const openSiYuanUriBlock = (
    app: AppFacade,
    blockInfo: Pick<NonNullable<ReturnType<typeof parseSiYuanUriInfo>>, "id" | "focus">,
    zoomIn: boolean,
) => {
    const action = getSiYuanUriAction(zoomIn, blockInfo.focus);
    app.openSiYuanBlock({
        id: blockInfo.id,
        action,
        zoomIn: zoomIn || blockInfo.focus,
    });
};

/** 在 Electron 成功接管块 URI 后前置应用窗口；其他宿主保持无操作语义。 */
const showElectronWindow = () => {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, "show");
    }
};

/** 处理块存在性响应；内核检查完成后按原顺序查询折叠、打开宿主、前置窗口并通知插件。 */
const handleBlockExistResponse = (context: {
    app: AppFacade;
    blockInfo: NonNullable<ReturnType<typeof parseSiYuanUriInfo>>;
    uriObj: URL;
}, existResponse: IWebSocketData) => {
    const {app, blockInfo, uriObj} = context;
    const {id, focus} = blockInfo;
    if (existResponse.data) {
        fetchPost("/api/block/checkBlockFold", {id}, (foldResponse) => {
            openSiYuanUriBlock(app, blockInfo, foldResponse.data.isFolded);
        });
        showElectronWindow();
    }
    for (const plugin of app.plugins) {
        plugin.eventBus.emit("open-siyuan-url-block", {
            url: uriObj.href,
            id,
            focus,
            exist: existResponse.data,
        });
    }
};

/** 处理 blocks URI 的存在性、折叠、宿主导航和插件事件；协议分派命中 blocks 时调用。 */
const processSiYuanUriBlocks = (app: AppFacade, uriObj: URL) => {
    const blockInfo = parseSiYuanUriInfo(uriObj);
    if (blockInfo === null) {
        return false;
    }
    const {id} = blockInfo;
    window.siyuan.editorIsFullscreen = blockInfo.fullscreen;
    const context = {app, blockInfo, uriObj};
    fetchPost("/api/block/checkBlockExist", {id}, handleBlockExistResponse.bind(undefined, context));
    return true;
};

/** 解码 plugins URI 的首段名称；插件分派前调用并显式拒绝缺失或非法编码。 */
const parsePluginNameOrTabType = (uriObj: URL) => {
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

/** 为未匹配已加载插件的 URI 打开既有自定义页签；仅桌面宿主执行。 */
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

/** 将 plugins URI 分派给已加载插件或原有自定义页签入口；协议主机命中 plugins 时调用。 */
const processSiYuanUriPlugins = (app: AppFacade, uriObj: URL) => {
    const pluginNameOrTabType = parsePluginNameOrTabType(uriObj);
    if (!pluginNameOrTabType) {
        return false;
    }

    const plugin = app.plugins.find((item) => pluginNameOrTabType === item.name);
    if (plugin) {
        plugin.eventBus.emit("open-siyuan-url-plugin", {url: uriObj.href});
        return true;
    }
    openPluginCustomTab(app, uriObj, pluginNameOrTabType);
    return true;
};

/**
 * 解析并同步接管 Editor 路径支持的 blocks/plugins SiYuan URI；链接分流和 App 公共方法调用。
 * @同步豁免: UI构建 - 点击和 window.open 分流必须在当前事件栈返回是否已接管，调用方据此阻止浏览器导航或执行外链后备动作。
 */
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
    const processors: Record<string, (targetApp: AppFacade, targetUri: URL) => boolean> = {
        blocks: processSiYuanUriBlocks,
        plugins: processSiYuanUriPlugins,
    };
    const processor = processors[uriObj.hostname];
    return processor ? processor(app, uriObj) : false;
};
