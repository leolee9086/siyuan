import { Editor } from ".";
import { Asset } from "../asset";
import { newCardModel } from "../card/newCardTab";
import { Constants } from "../constants";
import { Tab } from "../layout/Tab";
import { setPanelFocus } from "../layout/util";
import { Search } from "../search";
import { pathPosix, getDisplayName } from "../util/pathName";
const newAssetPathTab = (options:IOpenFileOptions) => {
    const suffix = pathPosix().extname(options.assetPath).split("?")[0];
    if (Constants.SIYUAN_ASSETS_EXTS.includes(suffix)) {
        let icon = "iconPDF";
        if (Constants.SIYUAN_ASSETS_IMAGE.includes(suffix)) {
            icon = "iconImage";
        } else if (Constants.SIYUAN_ASSETS_AUDIO.includes(suffix)) {
            icon = "iconRecord";
        } else if (Constants.SIYUAN_ASSETS_VIDEO.includes(suffix)) {
            icon = "iconVideo";
        }
        const tab = new Tab({
            icon,
            title: getDisplayName(options.assetPath),
            callback(tab) {
                tab.addModel(new Asset({
                    app: options.app,
                    tab,
                    path: options.assetPath,
                    page: options.page,
                }));
                setPanelFocus(tab.panelElement.parentElement.parentElement);
            }
        });
        return tab
    }
}
export const newTab = (options: IOpenFileOptions) => {
    let tab: Tab;
    if (options.assetPath) {
        tab = newAssetPathTab(options)
    } else if (options.custom) {
        tab = new Tab({
            icon: options.custom.icon,
            title: options.custom.title,
            callback(tab) {
                if (options.custom.id) {
                    if (options.custom.id === "siyuan-card") {
                        tab.addModel(newCardModel({
                            app: options.app,
                            tab,
                            data: options.custom.data
                        }));
                    } else {
                        options.app.plugins.find(p => {
                            if (p.models[options.custom.id]) {
                                tab.addModel(p.models[options.custom.id]({
                                    tab,
                                    data: options.custom.data
                                }));
                                return true;
                            }
                        });
                    }
                } else {
                    // plugin 0.8.3 历史兼容
                    console.warn("0.8.3 将移除 custom.fn 参数，请参照 https://github.com/siyuan-note/plugin-sample/blob/91a716358941791b4269241f21db25fd22ae5ff5/src/index.ts 将其修改为 custom.id");
                    tab.addModel(options.custom.fn({
                        tab,
                        data: options.custom.data
                    }));
                }
                setPanelFocus(tab.panelElement.parentElement.parentElement);
            }
        });
    } else if (options.searchData) {
        tab = new Tab({
            icon: "iconSearch",
            title: window.siyuan.languages.search,
            callback(tab) {
                tab.addModel(new Search({
                    app: options.app,
                    tab,
                    config: options.searchData
                }));
                setPanelFocus(tab.panelElement.parentElement.parentElement);
            }
        });
    } else {
        tab = new Tab({
            title: getDisplayName(options.fileName, true, true),
            docIcon: options.rootIcon,
            callback(tab) {
                let editor;
                if (options.zoomIn) {
                    editor = new Editor({
                        app: options.app,
                        tab,
                        blockId: options.id,
                        rootId: options.rootID,
                        action: [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS],
                    });
                } else {
                    editor = new Editor({
                        app: options.app,
                        tab,
                        blockId: options.id,
                        rootId: options.rootID,
                        mode: options.mode,
                        action: options.action,
                    });
                }
                tab.addModel(editor);
            }
        });
    }
    return tab;
};
