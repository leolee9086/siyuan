import { App } from "../../index";
import { Constants } from "../../constants";
import { Model } from "../../layout/Model";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/// #if !MOBILE
import { openFile } from "../../editor/util";
import { openFileById } from "../../editor/utils.openFileById";
/// #endif

interface IOpenTabDocOptions {
    id: string;
    action?: TProtyleAction[];
    zoomIn?: boolean;
}

interface IOpenTabPdfOptions {
    path: string;
    page?: number;
    id?: string;
}

interface IOpenTabAssetOptions {
    path: string;
}

interface IOpenTabCardOptions {
    type: TCardType;
    id?: string;
    title?: string;
}

interface IOpenTabCustomOptions {
    title: string;
    icon: string;
    data?: any;
    id: string;
}

export interface IOpenTabOptions {
    app: App;
    doc?: IOpenTabDocOptions;
    pdf?: IOpenTabPdfOptions;
    asset?: IOpenTabAssetOptions;
    search?: Config.IUILayoutTabSearchConfig;
    card?: IOpenTabCardOptions;
    custom?: IOpenTabCustomOptions;
    position?: "right" | "bottom";
    keepCursor?: boolean;
    removeCurrentTab?: boolean;
    afterOpen?: (model?: Model) => void;
}



/** 处理文档打开 */
const 处理文档打开 = (options: IOpenTabOptions) => {
    const doc = options.doc!;
    if (!doc.action) {
        doc.action = [];
    }
    if (doc.zoomIn && !doc.action.includes(Constants.CB_GET_ALL)) {
        doc.action.push(Constants.CB_GET_ALL);
    }
    return openFileById({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        id: doc.id,
        action: doc.action,
        zoomIn: doc.zoomIn
    });
};

/** 处理资源文件打开 */
const 处理资源打开 = (options: IOpenTabOptions) => {
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        assetPath: options.asset!.path,
    });
};

/** 处理PDF打开 */
const 处理PDF打开 = (options: IOpenTabOptions) => {
    const pdf = options.pdf!;
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        assetPath: pdf.path,
        page: pdf.id || pdf.page,
    });
};

/** 处理搜索打开 */
const 处理搜索打开 = (options: IOpenTabOptions) => {
    const search = options.search!;
    if (!search.idPath) {
        search.idPath = [];
    }
    if (!search.hPath) {
        search.hPath = "";
    }
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        searchData: search,
    });
};

/** 处理闪卡打开 */
const 处理闪卡打开 = (options: IOpenTabOptions) => {
    const card = options.card!;
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        custom: {
            icon: "iconRiffCard",
            title: siyuanI18n.spaceRepetition,
            data: {
                cardType: card.type,
                id: card.id || "",
                title: card.title,
            },
            id: "siyuan-card"
        },
    });
};

/** 打开Tab页签的主函数 */
export const openTab = (options: IOpenTabOptions) => {
    /// #if MOBILE
    return;
    // TODO: Mobile

    /// #else
    if (options.doc) {
        return 处理文档打开(options);
    }
    if (options.asset) {
        return 处理资源打开(options);
    }
    if (options.pdf) {
        return 处理PDF打开(options);
    }
    if (options.search) {
        return 处理搜索打开(options);
    }
    if (options.card) {
        return 处理闪卡打开(options);
    }
    if (options.custom) {
        return openFile(options);
    }
};
/// #endif
