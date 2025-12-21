import { Tab } from "../Tab";
import { Files } from "./Files";
import { Bookmark } from "./Bookmark";
import { Tag } from "./Tag";
import { Outline } from "./Outline";
import { Graph } from "./Graph";
import { Backlink } from "./Backlink";
import { Inbox } from "./Inbox";
import { CustomLists, ICustomList } from "./CustomLists";
import { App } from "../../index";
import { Plugin } from "../../plugin";
import { Protyle } from "../../protyle";
import { Model } from "../Model";

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

const MODEL_FACTORIES: Record<string, ModelFactory> = {
    file: initFile,
    bookmark: initBookmark,
    tag: initTag,
    outline: initOutline,
    graph: initGraph,
    globalGraph: initGlobalGraph,
    backlink: initBacklink,
    inbox: initInbox,
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
    data?: any
}): Model | undefined => {
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

export const createDockTab = (options: {
    app: App,
    type: string,
    editor?: Protyle,
    data?: any
}): Tab => {
    return new Tab({
        callback: (tab: Tab) => {
            const model = createModel({
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
