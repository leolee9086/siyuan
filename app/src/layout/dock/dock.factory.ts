import { Files } from "./Files";
import { Bookmark } from "./Bookmark";
import { Tag } from "./Tag";
import { Outline } from "./outline/Outline";
import { Graph } from "./Graph";
import { Backlink } from "./Backlink";
import { Forwardlink } from "./forwardlink/Forwardlink";
import { Inbox } from "./Inbox";
import {CustomLists} from "./customBlockLists/CustomLists";
import {showCustomListMenu} from "./customBlockLists/customLists.menu";
import { EmbeddingDock } from "./embeddingDock/EmbeddingDock";
import { Cronjob } from "./Cronjob";
import { createAgentDockModel } from "./agent/runtime/host/dock/dockModel.factory";
/** 用途：创建 s-forge 原生颜色 Dock；使用范围：MODEL_FACTORIES 的内建颜色类型；解耦评估：不经过插件列表，直接由颜色模块提供 Custom Model。 */
import { createColorToolDockModel } from "../../sforge/colors/init";
/** 用途：创建 S-Forge 文件浏览 Dock；使用范围：内建模型注册表；解耦评估：面板状态和 Vue 生命周期留在文件浏览领域。 */
import {
    createFileBrowserDockModel,
    createFilePropertiesDockModel,
    createFileTagTreeDockModel,
    FILE_BROWSER_DOCK_TYPE,
    FILE_PROPERTIES_DOCK_TYPE,
    FILE_TAG_TREE_DOCK_TYPE,
} from "../../sforge/fileBrowser/init";
import { createIdentityAccessDockModel } from "../../magi/identity-access/adapters/dock.factory";
import { Tab } from "./imports";
import type { AppFacade } from "./imports";
import type {ProtyleDomain} from "./imports";
import {Tree} from "./imports";
import type { ILayoutModel } from "./imports";
import {getDockByType} from "./imports";
import {setStorageVal} from "./imports";
import { createErrorPlaceholder } from "./errorPlaceholder/ErrorPlaceholder";
import { ERROR_PLACEHOLDER_TYPE } from "./errorPlaceholder/ErrorPlaceholder";
import { getSiyuanLanguages } from "./dock.environment";
import { getSiyuanStorage } from "./dock.environment";
import { isErrorPlaceholderData } from "./errorPlaceholder/ErrorPlaceholder.guard";
import { isModelConstructor } from "./dock.guard";
import { isICustomList } from "./dock.guard";
import { ModelFactory } from "./dock.types";
import { ModelConstructor } from "./dock.types";

/**
 * 初始化文件树 Dock
 * 
 * 作用：创建文件树组件实例
 * 意图：提供文件系统的可视化展示和操作
 * 调用时机：加载文件树 Dock 时
 */
const initFile: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab) => {
    return new Files({ tab, app });
};

/**
 * 初始化大纲 Dock
 * 
 * 作用：创建大纲组件实例
 * 意图：展示文档的标题结构大纲
 * 调用时机：加载大纲 Dock 时
 */
const initOutline: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab, editor) => {
    const blockId = editor?.protyle?.block?.rootID || "";
    const isPreview = false;
    const outline = new Outline({
        app,
        type: "pin",
        tab,
        blockId,
        isPreview
    });
    /**
     * 初始同步文档标题
     * 
     * 作用：如果编辑器当前已加载文档（有 rootID），则立即更新大纲面板的标题。
     * 意图：确保大纲打开时，其标题栏能够正确显示当前文档的名称和图标，而不是空白。
     */
    if (editor?.protyle?.block?.rootID) {
        outline.updateDocTitle(editor.protyle.background?.ial);
    }
    return outline;
};

/**
 * 初始化关系图 Dock
 * 
 * 作用：创建局部关系图组件实例
 * 意图：展示当前文档的相关引用关系
 * 调用时机：加载关系图 Dock 时
 */
const initGraph: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab, editor) => {
    return new Graph({
        app,
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
        type: "pin"
    });
};

/**
 * 初始化全局关系图 Dock
 * 
 * 作用：创建全局关系图组件实例
 * 意图：展示整个知识库的引用网络
 * 调用时机：加载全局关系图 Dock 时
 */
const initGlobalGraph: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab) => {
    return new Graph({
        app,
        tab,
        type: "global"
    });
};

/**
 * 初始化反向链接 Dock
 * 
 * 作用：创建反向链接组件实例
 * 意图：展示引用当前文档的其他文档列表
 * 调用时机：加载反向链接 Dock 时
 */
const initBacklink: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab, editor) => {
    return new Backlink({
        app,
        type: "pin",
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
    });
};

/**
 * 初始化正向链接 Dock
 * 
 * 作用：创建正向链接组件实例
 * 意图：显示当前文档引用的其他文档/块列表
 * 调用时机：加载正向链接 Dock 时
 */
const initForwardlink: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab, editor) => {
    return new Forwardlink({
        app,
        type: "pin",
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
    });
};

/**
 * 初始化自定义列表 Dock
 * 
 * 作用：创建自定义列表组件实例
 * 意图：支持用户自定义的数据列表展示
 * 调用时机：加载自定义列表 Dock 时
 */
/** @参数豁免: 生命周期 - 布局反序列化要求所有模型工厂遵守统一的四参数调用协议。 */
const initCustomList: ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> = (app, tab, editor, data) => {
    // isICustomList 已排除 null/undefined/非对象，无需额外 !data 真值检查；
    // 否则 !data 会将 unknown 先收窄为 {}，导致类型守卫无法在 || 否定分支中收窄为 ICustomList
    if (!isICustomList(data)) {
        return undefined;
    }
    return new CustomLists(
        app,
        tab,
        data,
        getDockByType,
        (customLists) => setStorageVal("local-customlists", customLists),
        (options) => new Tree(options),
        showCustomListMenu,
    );
};

const MODEL_FACTORIES: Record<string, ModelFactory<AppFacade, Tab, ProtyleDomain, unknown> | ModelConstructor<AppFacade, Tab, ProtyleDomain, unknown>> = {
    file: initFile,
    bookmark: Bookmark,
    tag: Tag,
    outline: initOutline,
    graph: initGraph,
    globalGraph: initGlobalGraph,
    backlink: initBacklink,
    forwardlink: initForwardlink,
    inbox: Inbox,
    embedding_dock: EmbeddingDock,
    cronjob: Cronjob,
    agentChat: createAgentDockModel,
    "magi-identity-access": createIdentityAccessDockModel,
    "sforge-colors": createColorToolDockModel,
    [FILE_BROWSER_DOCK_TYPE]: createFileBrowserDockModel,
    [FILE_PROPERTIES_DOCK_TYPE]: createFilePropertiesDockModel,
    [FILE_TAG_TREE_DOCK_TYPE]: createFileTagTreeDockModel,
};

/**
 * 初始化插件 Dock
 * 
 * 作用：查找并初始化插件提供的 Dock
 * 意图：支持插件扩展 Dock 功能
 * 调用时机：当 Dock 类型为非内置类型时尝试加载插件
 */
const initPlugin = (app: AppFacade, tab: Tab, type: string) => {
    let customModel: ILayoutModel | undefined;
    for (const item of app.plugins) {
        const dock = item.docks[type];
        // dock.model 为可选属性，需同时校验 dock 与 dock.model，避免调用未定义函数
        if (dock?.model) {
            customModel = dock.model({ tab });
            break;
        }
    }
    return customModel;
};

/**
 * 获取自定义列表数据
 * 
 * 作用：解析或从存储中恢复自定义列表数据
 * 意图：处理 custom_list 类型的特殊数据恢复逻辑
 * 调用时机：createModel 中遇到 custom_list 类型但没有 data 时
 */
const getCustomListData = (type: string) => {
    const parts = type.split(":");
    const uuid = parts.length > 2 ? parts[parts.length - 1] : "";
    if (!uuid) {
        return undefined;
    }

    const storage = getSiyuanStorage();
    const customLists = storage ? storage["local-customlists"] : undefined;
    // 显式分步获取数据，避免隐式上下文切换 lint 错误
    let data = customLists ? customLists[uuid] : undefined;

    if (!data) {
        data = {
            id: uuid,
            title: getSiyuanLanguages()?.remove,
            icon: "iconTrashcan",
            type: parts[1],
            target: ""
        };
    }
    return data;
};

/**
 * 创建 Dock Model 实例
 *
 * 作用：根据传入的 type 创建对应的 Model 实例（如 File, Outline, Graph 等）。
 * 意图：作为统一的工厂入口，屏蔽不同 Model 的创建细节，支持内置 Model、自定义列表和插件 Model。
 * 调用时机：在 Dock 初始化、Tab 恢复或插件请求创建 Dock 时调用。
 * 问题/改进：目前混合了工厂模式和部分业务逻辑（如 custom_list 的数据恢复），未来可将 custom_list 逻辑抽离。
 */
export const createModel = (options: {
    app: AppFacade,
    tab: Tab,
    type: string,
    editor?: ProtyleDomain | undefined,
    data?: unknown
}) => {
    // 处理已保存的错误占位符
    if (options.type === ERROR_PLACEHOLDER_TYPE && isErrorPlaceholderData(options.data)) {
        return createErrorPlaceholder({
            element: options.tab.panelElement,
            data: options.data,
        });
    }

    const factory = MODEL_FACTORIES[options.type];
    if (factory) {
        return isModelConstructor(factory)
            ? new factory(options.app, options.tab, options.editor, options.data)
            : factory(options.app, options.tab, options.editor, options.data);
    }

    // 检查是否为自定义列表类型，如果是则尝试恢复或初始化数据
    if (options.type.startsWith("custom_list")) {
        const data = options.data || getCustomListData(options.type);
        return initCustomList(options.app, options.tab, options.editor, data);
    }

    return initPlugin(options.app, options.tab, options.type);
};

/**
 * 安全创建 dock model
 * 
 * 作用：包装 createModel，捕获创建过程中的错误
 * 意图：当组件创建失败时返回 ErrorPlaceholder 而不是抛出异常
 * 调用时机：在 createDockTab 和其他需要安全创建 model 的地方使用
 */
export const safeCreateModel = (options: {
    app: AppFacade,
    tab: Tab,
    type: string,
    editor?: ProtyleDomain | undefined,
    data?: unknown
}) => {
    try {
        return createModel(options);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error("[safeCreateModel] 创建失败:", options.type, error);

        return createErrorPlaceholder({
            element: options.tab.panelElement,
            data: {
                原始类型: options.type,
                错误信息: errorMessage,
                ...(errorStack ? { 错误堆栈: errorStack } : {}),
            },
        });
    }
};

/**
 * 创建 dock tab
 * 
 * 作用：创建一个带有指定类型 model 的 tab
 * 意图：统一 dock tab 的创建逻辑
 * 调用时机：在 dock 初始化或切换时调用
 */
export const createDockTab = (options: {
    app: AppFacade,
    type: string,
    editor?: ProtyleDomain,
    data?: unknown
}) => {
    return new Tab({
        /**  创建 Tab 后的回调，创建并添加 model */
        callback: (tab: Tab) => {
            // 使用 safeCreateModel 确保错误被捕获并显示为占位符
            const model = safeCreateModel({
                app: options.app,
                tab,
                type: options.type,
                editor: options.editor,
                data: options.data
            });
            if (model) {
                tab.addModel(model);
            }
        }
    });
};
