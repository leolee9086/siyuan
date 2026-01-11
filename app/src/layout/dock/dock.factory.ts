import { Tab } from "../Tab";
import { Files } from "./Files";
import { Bookmark } from "./Bookmark";
import { Tag } from "./Tag";
import { Outline } from "./outline/Outline";
import { Graph } from "./Graph";
import { Backlink } from "./Backlink";
import { Inbox } from "./Inbox";
import { CustomLists, ICustomList } from "./customBlockLists/CustomLists";
import { EmbeddingDock } from "./embeddingDock/EmbeddingDock";
import { Cronjob } from "./Cronjob";
import { App } from "../../index";
import { Protyle } from "../../protyle";
import { Model } from "../Model";
import { ErrorPlaceholder, ERROR_PLACEHOLDER_TYPE, createErrorPlaceholderFromData } from "./ErrorPlaceholder";
import { isErrorPlaceholderData } from "./dock.guard";

type ModelFactory = (app: App, tab: Tab, editor?: Protyle, data?: any) => Model | undefined;

const initFile: ModelFactory = (app, tab) => {
    return new Files({ tab, app });
};

const initBookmark: ModelFactory = (app, tab) => {
    return new Bookmark(app, tab);
};

const initTag: ModelFactory = (app, tab) => {
    return new Tag(app, tab);
};

const initOutline: ModelFactory = (app, tab, editor) => {
    const blockId = editor?.protyle?.block?.rootID || "";
    const preview = editor?.protyle?.preview;
    const isPreview = preview ? !preview.element.classList.contains("fn__none") : false;
    const outline = new Outline({
        app,
        type: "pin",
        tab,
        blockId,
        isPreview
    });
    if (editor?.protyle?.block?.rootID) {
        outline.updateDocTitle(editor.protyle.background?.ial);
    }
    return outline;
};

const initGraph: ModelFactory = (app, tab, editor) => {
    return new Graph({
        app,
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
        type: "pin"
    });
};

const initGlobalGraph: ModelFactory = (app, tab) => {
    return new Graph({
        app,
        tab,
        type: "global"
    });
};

const initBacklink: ModelFactory = (app, tab, editor) => {
    return new Backlink({
        app,
        type: "pin",
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
    });
};

const initInbox: ModelFactory = (app, tab) => {
    return new Inbox(app, tab);
};

const initCustomList: ModelFactory = (app, tab, editor, data) => {
    if (!data) {
        return undefined;
    }
    return new CustomLists(app, tab, data as ICustomList);
};

const initEmbeddingDock: ModelFactory = (app, tab) => {
    return new EmbeddingDock(app, tab);
};

const initCronjob: ModelFactory = (app, tab) => {
    return new Cronjob(app, tab);
};

const MODEL_FACTORIES: Record<string, ModelFactory> = {
    file: initFile,
    bookmark: initBookmark,
    tag: initTag,
    outline: initOutline,
    graph: initGraph,
    globalGraph: initGlobalGraph,
    backlink: initBacklink,
    inbox: initInbox,
    embedding_dock: initEmbeddingDock,
    cronjob: initCronjob,
};

const initPlugin = (app: App, tab: Tab, type: string) => {
    let customModel;
    for (const item of app.plugins) {
        if (item.docks[type]) {
            customModel = item.docks[type].model({ tab });
            break;
        }
    }
    return customModel;
};

export const createModel = (options: {
    app: App,
    tab: Tab,
    type: string,
    editor?: Protyle,
    data?: unknown
}): Model | undefined => {
    // 处理已保存的错误占位符
    if (options.type === ERROR_PLACEHOLDER_TYPE && isErrorPlaceholderData(options.data)) {
        return createErrorPlaceholderFromData(options.app, options.tab, options.data);
    }

    const factory = MODEL_FACTORIES[options.type];
    if (factory) {
        return factory(options.app, options.tab, options.editor, options.data);
    }

    if (options.type.startsWith("custom_list")) {
        let data = options.data;
        if (!data) {
            const parts = options.type.split(":");
            const uuid = parts.length > 2 ? parts[parts.length - 1] : "";
            if (uuid) {
                const storage = window.siyuan.storage["local-customlists"];
                data = storage ? storage[uuid] : undefined;
                if (!data) {
                    data = {
                        id: uuid,
                        title: window.siyuan.languages.remove,
                        icon: "iconTrashcan",
                        type: parts[1],
                        target: ""
                    };
                }
            }
        }
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
    app: App,
    tab: Tab,
    type: string,
    editor?: Protyle,
    data?: unknown
}): Model | undefined => {
    try {
        return createModel(options);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error("[safeCreateModel] 创建失败:", options.type, error);

        return new ErrorPlaceholder({
            app: options.app,
            tab: options.tab,
            原始类型: options.type,
            错误信息: errorMessage,
            错误堆栈: errorStack ?? undefined,
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
    app: App,
    type: string,
    editor?: Protyle,
    data?: unknown
}): Tab => {
    return new Tab({
        /** @简洁函数 创建 Tab 后的回调，创建并添加 model */
        callback: (tab: Tab) => {
            // 使用 safeCreateModel 确保错误被捕获并显示为占位符
            const model = safeCreateModel({
                app: options.app,
                tab,
                type: options.type,
                editor: options.editor ?? undefined,
                data: options.data ?? undefined
            });
            if (model) {
                tab.addModel(model);
            }
        }
    });
};
