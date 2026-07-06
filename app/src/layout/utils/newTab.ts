import { Editor } from "./imports";
import type { IEditorOptions } from "./imports";
import { Asset } from "./imports";
import { newCardModel } from "./imports";
import { Constants } from "./imports";
import { Tab } from "./imports";
import { setPanelFocus } from "./setPanelFocus";
import { tabRegistry } from "./imports";
import { Search } from "./imports";
import { pathPosix } from "./imports";
import { getDisplayName } from "./imports";
import { getDocDisplayName } from "./imports";
import { siyuanI18n } from "./imports";

/**
 * 根据选项创建一个新页签。
 * @param options - 打开文件/页签的选项。
 * @returns 创建的页签实例，如果没有创建页签则返回 undefined。
 */
export const newTab = (options: IOpenFileOptions) => {
    if (options.assetPath) {
        return newAssetTab(options);
    }
    if (options.custom) {
        return newCustomTab(options);
    }
    if (options.searchData) {
        return newSearchTab(options);
    }
    return newEditorTab(options);
};

/**
 * 根据后缀获取资源图标。
 * @param suffix - 文件后缀。
 * @returns 图标名称。
 */
const getAssetIcon = (suffix: string) => {
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(suffix)) {
        return "iconImage";
    }
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(suffix)) {
        return "iconRecord";
    }
    if (Constants.SIYUAN_ASSETS_VIDEO.includes(suffix)) {
        return "iconVideo";
    }
    return "iconPDF";
};

/**
 * 安全设置面板焦点
 * @param tab - 页签实例
 */
const safeSetFocus = (tab: Tab) => {
    if (tab.panelElement.parentElement?.parentElement) {
        setPanelFocus(tab.panelElement.parentElement.parentElement);
    }
};

/**
 * 创建一个新的资源页签。
 * @param options - 选项。
 * @returns 页签实例或 undefined。
 */
const newAssetTab = (options: IOpenFileOptions) => {
    const assetPath = options.assetPath;
    if (!assetPath) {
        return;
    }
    const suffix = pathPosix().extname(assetPath).split("?")[0] || "";
    if (!Constants.SIYUAN_ASSETS_EXTS.includes(suffix)) {
        return;
    }
    return new Tab({
        icon: getAssetIcon(suffix),
        title: getDisplayName(assetPath),
        /**
         * 页签回调
         * @param tab - 页签实例
         */
        callback(tab) {
            tab.addModel(new Asset({
                app: options.app,
                tab,
                path: assetPath,
                ...(options.page !== undefined ? { page: options.page } : {}),
            }));
            safeSetFocus(tab);
        }
    });
};

/**
 * 创建一个新的自定义页签。
 * @param options - 选项。
 * @returns 页签实例。
 */
const newCustomTab = (options: IOpenFileOptions) => {
    const custom = options.custom;
    if (!custom) {
        return new Tab({});
    }
    return new Tab({
        icon: custom.icon,
        title: custom.title,
        /**
         * 页签回调
         * @param tab - 页签实例
         */
        callback(tab) {
            if (custom.id) {
                initCustomTabModel(options, tab, custom);
                safeSetFocus(tab);
                return;
            }
            // plugin 0.8.3 历史兼容
            if (custom.fn) {
                console.warn("0.8.3 将移除 custom.fn 参数，请参照 https://github.com/siyuan-note/plugin-sample/blob/91a716358941791b4269241f21db25fd22ae5ff5/src/index.ts 将其修改为 custom.id");
                tab.addModel(custom.fn({
                    tab,
                    data: custom.data
                }));
            }
            safeSetFocus(tab);
        }
    });
};

/**
 * 初始化自定义页签的模型。
 * @param options - 选项
 * @param tab - 页签
 * @param custom - 自定义选项
 */
const initCustomTabModel = (options: IOpenFileOptions, tab: Tab, custom: NonNullable<IOpenFileOptions["custom"]>) => {
    if (custom.id === "siyuan-card") {
        tab.addModel(newCardModel({
            app: options.app,
            tab,
            data: custom.data
        }));
        return;
    }
    // 优先从全局 TabRegistry 查找
    const registryModel = tabRegistry.createModel({
        app: options.app,
        tab,
        type: custom.id,
        data: custom.data,
    });
    if (registryModel) {
        tab.addModel(registryModel);
        return;
    }
    for (const p of options.app.plugins) {
        const createModel = p.models[custom.id];
        if (createModel) {
            tab.addModel(createModel({
                tab,
                data: custom.data
            }));
            break;
        }
    }
};

/**
 * 创建一个新的搜索页签。
 * @param options - 选项。
 * @returns 页签实例。
 */
const newSearchTab = (options: IOpenFileOptions) => {
    const config = options.searchData;
    if (!config) {
        throw new Error("options.searchData is missing");
    }
    return new Tab({
        icon: "iconSearch",
        title: siyuanI18n.search,
        /**
         * 页签回调
         * @param tab - 页签实例
         */
        callback(tab) {
            tab.addModel(new Search({
                app: options.app,
                tab,
                config
            }));
            safeSetFocus(tab);
        }
    });
};

/**
 * 创建一个新的编辑器页签。
 * @param options - 选项。
 * @returns 页签实例。
 */
const newEditorTab = (options: IOpenFileOptions) => {
    const { id, app, rootID } = options;
    if (!id) {
        throw new Error("options.id is missing");
    }
    if (!app) {
        throw new Error("options.app is missing");
    }
    if (!rootID) {
        throw new Error("options.rootID is missing");
    }

    return new Tab({
        title: getDocDisplayName(options.fileName || "", options.rootTitleEmpty),
        ...(options.rootIcon ? { docIcon: options.rootIcon } : {}),
        /**
         * 页签回调
         * @param tab - 页签实例
         */
        callback(tab) {
            if (options.zoomIn) {
                tab.addModel(new Editor({
                    app: app,
                    tab,
                    blockId: id,
                    rootId: rootID,
                    action: [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS],
                }));
                return;
            }
            const editorOptions: IEditorOptions = {
                app,
                tab,
                blockId: id,
                rootId: rootID,
            };
            if (options.mode) {
                editorOptions.mode = options.mode;
            }
            if (options.action) {
                editorOptions.action = options.action;
            }
            tab.addModel(new Editor(editorOptions));
        }
    });
};
