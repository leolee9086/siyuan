/**
 * 用途：打开自定义 Tab 所需的文件入口能力。
 * 使用范围：本文件所有 open*Tab 函数最终都通过该能力创建新页签。
 * 解耦评估：编辑器打开能力属于基础依赖，业务层通过网关接入可减少路径耦合。
 */
import { openFile } from "./imports";

/**
 * 用途：获取当前已存在的模型列表。
 * 使用范围：在打开 Tab 前检测是否已有同类型实例并复用。
 * 解耦评估：模型查询能力属于布局层基础依赖，业务层通过网关导入可降低耦合。
 */
import { getAllModels } from "./imports";

/**
 * 用途：读取国际化文案。
 * 使用范围：新建 Tab 时拼接标题。
 * 解耦评估：i18n 能力属于环境层稳定依赖，通过网关导入可降低路径耦合。
 */
import { siyuanI18n } from "./imports";

/**
 * 用途：读取页面 origin。
 * 使用范围：构造本地集市源页面 URL。
 * 解耦评估：window.location 访问已在环境层封装，业务层通过网关导入可降低全局耦合。
 */
import { getLocationOrigin } from "./imports";

/**
 * 用途：读取安全配置快照。
 * 使用范围：当 origin 为空时回退到 serverAddrs 计算本地地址。
 * 解耦评估：配置访问属于环境层能力，通过网关导入可避免直接全局耦合。
 */
import { getSafeSiyuanConfig } from "./imports";

/**
 * 用途：读取当前 WebSocket 容器。
 * 使用范围：未显式传入 app 时尝试恢复应用上下文。
 * 解耦评估：全局 ws 访问属于环境层能力，通过网关导入可降低硬耦合。
 */
import { getSiyuanWebSocket } from "./imports";

/**
 * 用途：应用实例类型定义。
 * 使用范围：open 函数参数与内部 app 解析。
 */
import type {AppFacade} from "./imports";

/**
 * 用途：集市广场切换源事件名。
 * 使用范围：当复用已打开的 hub Tab 时通知其切换 sourceID。
 * 解耦评估：事件名常量由同目录维护，直接同层依赖边界清晰。
 */
import { BAZAAR_HUB_SET_SOURCE_EVENT } from "./constants";

/**
 * 用途：集市广场 Tab 类型标识。
 * 使用范围：查找或创建 bazaar hub Tab。
 * 解耦评估：常量由同目录维护，直接同层依赖边界清晰。
 */
import { BAZAAR_HUB_TAB_TYPE } from "./constants";

/**
 * 用途：发布设置 Tab 类型标识。
 * 使用范围：查找或创建 bazaar publish Tab。
 * 解耦评估：常量由同目录维护，直接同层依赖边界清晰。
 */
import { BAZAAR_PUBLISH_TAB_TYPE } from "./constants";

/**
 * 用途：第三方源 Tab 类型标识。
 * 使用范围：查找或创建 bazaar source Tab。
 * 解耦评估：常量由同目录维护，直接同层依赖边界清晰。
 */
import { BAZAAR_SOURCE_TAB_TYPE } from "./constants";

/**
 * 用途：从未知对象读取字符串字段。
 * 意图：避免对 custom data 使用类型断言，并统一空值处理。
 * 调用时机：读取模型 data.sourceID 时调用。
 * 问题/改进：当前仅支持字符串字段，后续可扩展为结构化读取器。
 */
const readCustomString = (data: unknown, key: string) => {
    if (!data || typeof data !== "object") {
        return "";
    }
    const rawValue = Reflect.get(data, key);
    if (typeof rawValue !== "string") {
        return "";
    }
    return rawValue;
};

/**
 * 用途：解析可用的 App 实例。
 * 意图：优先使用调用方显式传入的 app，缺省时回退到全局 ws 上下文。
 * 调用时机：所有 open*Tab 入口开始时调用。
 * 问题/改进：ws 回退依赖运行时环境，后续可考虑统一注入 app 上下文。
 */
const resolveApp = (app?: AppFacade) => {
    if (app) {
        return app;
    }
    const ws = getSiyuanWebSocket();
    if (!ws) {
        return undefined;
    }
    return ws.app;
};

/**
 * 用途：计算本地源页面使用的 origin。
 * 意图：优先使用浏览器 origin，缺省时回退到配置中的 serverAddrs。
 * 调用时机：生成本地集市源 URL 时调用。
 * 问题/改进：若 serverAddrs 配置为空会返回空字符串，调用方需容忍该结果。
 */
const getLocalOrigin = () => {
    const browserOrigin = (getLocationOrigin() || "").replace(/\/+$/, "");
    if (browserOrigin) {
        return browserOrigin;
    }
    const config = getSafeSiyuanConfig();
    const serverAddrs = config?.serverAddrs || [];
    const firstAddress = serverAddrs[0] || "";
    return firstAddress.replace(/\/+$/, "");
};

/**
 * 用途：激活已存在的自定义模型页签。
 * 意图：将“切换并显示页签”逻辑抽到单点，减少重复代码。
 * 调用时机：每次命中 existingModel 时调用。
 * 问题/改进：当前仅处理 headElement 可用场景，后续可扩展容错日志。
 */
const activateExistingTab = (model: unknown) => {
    if (!model || typeof model !== "object") {
        return false;
    }
    const parentNode = Reflect.get(model, "parent");
    if (!parentNode || typeof parentNode !== "object") {
        return false;
    }
    const headElement = Reflect.get(parentNode, "headElement");
    if (!headElement) {
        return false;
    }
    const stack = Reflect.get(parentNode, "parent");
    if (!stack || typeof stack !== "object") {
        return false;
    }
    const switchTab = Reflect.get(stack, "switchTab");
    const showHeading = Reflect.get(stack, "showHeading");
    if (typeof switchTab !== "function" || typeof showHeading !== "function") {
        return false;
    }
    switchTab.call(stack, headElement);
    showHeading.call(stack);
    return true;
};

/**
 * 用途：在已打开的 hub Tab 上派发切换源事件。
 * 意图：复用 hub Tab 时保持与新开 Tab 一致的 sourceID 切换行为。
 * 调用时机：openBazaarHubTab 命中 existingModel 后调用。
 * 问题/改进：当前失败时静默忽略，后续可按需补充调试日志。
 */
const dispatchHubSourceIfNeeded = (model: unknown, sourceID: string) => {
    if (!sourceID) {
        return;
    }
    if (!model || typeof model !== "object") {
        return;
    }
    const element = Reflect.get(model, "element");
    if (!(element instanceof HTMLElement)) {
        return;
    }
    element.dispatchEvent(new CustomEvent(BAZAAR_HUB_SET_SOURCE_EVENT, {
        detail: { sourceID },
    }));
};

/**
 * 用途：判断模型是否为指定 sourceID 的第三方源页签。
 * 意图：避免在 find 回调中写长逻辑，满足内联回调长度约束并提升可读性。
 * 调用时机：openBazaarSourceTab 查找已有页签时调用。
 * 问题/改进：当前仅依据 type + sourceID 匹配，如需多维匹配可继续扩展。
 */
const isSourceTabModel = (model: unknown, sourceID: string) => {
    if (!model || typeof model !== "object") {
        return false;
    }
    const modelType = Reflect.get(model, "type");
    if (modelType !== BAZAAR_SOURCE_TAB_TYPE) {
        return false;
    }
    const data = Reflect.get(model, "data");
    const modelSourceID = readCustomString(data, "sourceID");
    return modelSourceID === sourceID;
};

/**
 * 用途：生成本地第三方源页面 URL。
 * 意图：供“本地集市源”入口复用统一地址规则。
 * 调用时机：openLocalBazaarSourceTab 构建 source.url 时调用。
 * 问题/改进：地址路径当前固定，后续若接口变更需同步调整。
 * @同步豁免: 生命周期
 */
/** 导出 getLocalBazaarSourcePageURL 供本地源入口复用 */
export const getLocalBazaarSourcePageURL = () => {
    return `${getLocalOrigin()}/api/s-forge/bazaar/public/source`;
};

/**
 * 用途：打开或激活集市广场 Tab。
 * 意图：统一处理“复用已有页签”与“创建新页签”两条路径。
 * 调用时机：发布设置页、命令入口或其他模块打开广场时调用。
 * 问题/改进：当前 sourceID 通过事件同步，未来可考虑集中状态总线。
 */
/** 导出 openBazaarHubTab 供 bazaar-hub 相关入口调用 */
export const openBazaarHubTab = async (options?: { app?: AppFacade; sourceID?: string }) => {
    const app = resolveApp(options?.app);
    if (!app) {
        return;
    }

    const sourceID = (options?.sourceID || "").trim();
    const existingModel = getAllModels().custom.find((item) => item.type === BAZAAR_HUB_TAB_TYPE);
    const reusedExistingTab = activateExistingTab(existingModel);
    if (reusedExistingTab) {
        dispatchHubSourceIfNeeded(existingModel, sourceID);
        return;
    }

    await openFile({
        app,
        custom: {
            title: `${siyuanI18n.bazaar} Hub`,
            icon: "iconBazaar",
            id: BAZAAR_HUB_TAB_TYPE,
            data: { sourceID },
        },
    });
};

/**
 * 用途：打开或激活发布设置 Tab。
 * 意图：保证发布设置只保留一个实例并可快速回到该页签。
 * 调用时机：集市广场工具栏或其他入口点击“发布设置”时调用。
 * 问题/改进：当前标题拼接固定为“发布 · 集市”，后续可按语言习惯优化顺序。
 */
/** 导出 openBazaarPublishTab 供发布设置入口调用 */
export const openBazaarPublishTab = async (options?: { app?: AppFacade }) => {
    const app = resolveApp(options?.app);
    if (!app) {
        return;
    }

    const existingModel = getAllModels().custom.find((item) => item.type === BAZAAR_PUBLISH_TAB_TYPE);
    if (activateExistingTab(existingModel)) {
        return;
    }

    await openFile({
        app,
        custom: {
            title: `${siyuanI18n.publish} · ${siyuanI18n.bazaar}`,
            icon: "iconUpload",
            id: BAZAAR_PUBLISH_TAB_TYPE,
        },
    });
};

/**
 * 用途：打开或激活第三方源 Tab。
 * 意图：按 sourceID 复用已有源页签，避免重复创建同源页面。
 * 调用时机：广场源列表或发布设置中的“打开 Tab”动作触发时调用。
 * 问题/改进：source.openInTab 为 false 时直接返回，未提示用户，可按需补充交互反馈。
 */
/** 导出 openBazaarSourceTab 供第三方源页签入口调用 */
export const openBazaarSourceTab = async (options: {
    app?: AppFacade;
    source: Pick<Config.IBazaarSource, "id" | "name" | "url"> & { openInTab?: boolean };
}) => {
    const app = resolveApp(options.app);
    if (!app) {
        return;
    }
    if (options.source.openInTab === false) {
        return;
    }

    const sourceID = (options.source.id || "").trim();
    const existingModel = getAllModels().custom.find((item) => isSourceTabModel(item, sourceID));
    if (activateExistingTab(existingModel)) {
        return;
    }

    await openFile({
        app,
        custom: {
            title: options.source.name || options.source.url || "Bazaar Source",
            icon: "iconLink",
            id: BAZAAR_SOURCE_TAB_TYPE,
            data: {
                sourceID: options.source.id,
                sourceName: options.source.name,
                sourceURL: options.source.url,
            },
        },
    });
};

/**
 * 用途：打开本地集市源 Tab。
 * 意图：封装本地源固定参数，提供统一入口给调用方。
 * 调用时机：广场与发布设置中点击“本地集市源”时调用。
 * 问题/改进：本地源名称当前固定中文，后续可接入 i18n。
 */
/** 导出 openLocalBazaarSourceTab 供本地源入口调用 */
export const openLocalBazaarSourceTab = async (options?: { app?: AppFacade }) => {
    await openBazaarSourceTab({
        app: options?.app,
        source: {
            id: "local-publish-source",
            name: "本地集市源",
            url: getLocalBazaarSourcePageURL(),
            openInTab: true,
        },
    });
};
