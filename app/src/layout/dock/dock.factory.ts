import { Tab } from "../Tab";
import { Files } from "./Files";
import { Bookmark } from "./Bookmark";
import { Tag } from "./Tag";
import { Outline } from "./Outline";
import { Graph } from "./Graph";
import { Backlink } from "./Backlink";
import { Inbox } from "./Inbox";
import { App } from "../../index";
import { Plugin } from "../../plugin";
import { Protyle } from "../../protyle";

type ModelInitializer = (app: App, tab: Tab, editor?: Protyle) => void;

const initFile: ModelInitializer = (app, tab) => {
    tab.addModel(new Files({ tab, app }));
};

const initBookmark: ModelInitializer = (app, tab) => {
    tab.addModel(new Bookmark(app, tab));
};

const initTag: ModelInitializer = (app, tab) => {
    tab.addModel(new Tag(app, tab));
};

const initOutline: ModelInitializer = (app, tab, editor) => {
    const blockId = editor?.protyle?.block?.rootID || "";
    const isPreview = editor?.protyle?.preview ? !editor.protyle.preview.element.classList.contains("fn__none") : false;
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
    tab.addModel(outline);
};

const initGraph: ModelInitializer = (app, tab, editor) => {
    tab.addModel(new Graph({
        app,
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
        type: "pin"
    }));
};

const initGlobalGraph: ModelInitializer = (app, tab) => {
    tab.addModel(new Graph({
        app,
        tab,
        type: "global"
    }));
};

const initBacklink: ModelInitializer = (app, tab, editor) => {
    tab.addModel(new Backlink({
        app,
        type: "pin",
        tab,
        blockId: editor?.protyle?.block?.rootID || "",
    }));
};

const initInbox: ModelInitializer = (app, tab) => {
    tab.addModel(new Inbox(app, tab));
};

const MODEL_INITIALIZERS: Record<string, ModelInitializer> = {
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
    app.plugins.find((item: Plugin) => {
        if (item.docks[type]) {
            customModel = item.docks[type].model({ tab });
            return true;
        }
    });
    if (customModel) {
        tab.addModel(customModel);
    }
};

export const createDockTab = (options: {
    app: App,
    type: string,
    editor?: Protyle
}): Tab => {
    return new Tab({
        callback: (tab: Tab) => {
            const initializer = MODEL_INITIALIZERS[options.type];
            if (initializer) {
                initializer(options.app, tab, options.editor);
            } else {
                initPlugin(options.app, tab, options.type);
            }
        }
    });
};
