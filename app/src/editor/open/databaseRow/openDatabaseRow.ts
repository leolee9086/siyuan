/** 用途：数据库行导航数据契约；使用范围：桌面导航实现；解耦评估：经本目录网关直达完整 AppFacade 声明。 */
import type {AppDatabaseRowNavigation} from "./imports";
/** 用途：完整应用领域根；使用范围：桌面导航实现；解耦评估：经本目录网关直达抽象，不加载具体 App。 */
import type {AppFacade} from "./imports";
/** 用途：复用块打开动作协议；使用范围：绑定数据库行预览；解耦评估：经本目录网关直达无状态协议常量。 */
import {Constants} from "./imports";
/** 用途：打开分离数据库行的自定义页签；使用范围：桌面分离条目；解耦评估：经子域网关直达具体打开实现，AV 仅依赖 AppFacade。 */
import {openFile} from "./imports";

/**
 * 作用：使用桌面自定义页签呈现分离数据库条目。
 * 意图：保持分离条目与绑定块预览不同的导航生命周期和载荷结构。
 * 调用时机：完整桌面数据库行导航识别到 `isDetached` 后立即调用。
 */
const openDetachedDatabaseRow = (app: AppFacade, options: AppDatabaseRowNavigation, title: string) => {
    if (!options.databaseBlockID) {
        return;
    }
    void openFile({
        app,
        position: "right",
        removeCurrentTab: false,
        custom: {
            id: "siyuan-database-row",
            icon: "iconDatabase",
            title,
            data: {
                avID: options.avID,
                blockID: options.databaseBlockID,
                notebookId: options.notebookID,
                itemID: options.itemID,
                valueID: options.valueID,
                title,
            },
        },
    });
};

/** 桌面端数据库行导航：分离的条目使用自定义页签，绑定条目使用可复用的编辑器预览。 @同步豁免: UI构建 - 当前点击栈内立即选择导航分支，实际文件打开仍沿用既有异步实现。 */
export const openDesktopDatabaseRow = (app: AppFacade, options: AppDatabaseRowNavigation) => {
    const title = options.title || window.siyuan.languages?.untitled;
    if (!title) {
        throw new Error("Database row navigation requires a title or initialized languages");
    }
    if (options.isDetached) {
        openDetachedDatabaseRow(app, options, title);
        return;
    }
    if (!options.boundBlockID) {
        return;
    }
    app.openBlock({
        id: options.boundBlockID,
        zoomIn: true,
        action: [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS],
        databaseRowId: options.boundBlockID,
    });
};
