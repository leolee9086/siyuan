/** 用途：块导航数据契约；使用范围：数据库行预览；解耦评估：经子域网关直达完整 AppFacade 声明。 */
import type {AppBlockNavigation} from "./imports";
/** 用途：完整应用领域根；使用范围：数据库行预览；解耦评估：经子域网关直达抽象。 */
import type {AppFacade} from "./imports";
/** 用途：完整 Editor 领域根；使用范围：预览状态投影；解耦评估：经子域网关直达抽象。 */
import type {EditorDomain} from "./imports";
/** 用途：全部页签查询；使用范围：预览复用；解耦评估：经子域网关直达唯一查询实现。 */
import {getAllTabs} from "./imports";
/** 用途：Editor 厂牌守卫；使用范围：页签模型收窄；解耦评估：经子域网关直达领域守卫。 */
import {isEditorDomain} from "./imports";
/** 用途：按块 ID 打开 Editor；使用范围：创建预览；解耦评估：经子域网关直达具体导航实现。 */
import {openFileById} from "./imports";
/** 用途：持久化页签数据守卫；使用范围：未初始化预览识别；解耦评估：同子域纯守卫。 */
import {isDatabaseRowTabData} from "./databaseRowTab.guard";

/** 作用：投影数据库行身份并恢复属性面板；意图：新建和复用页签共享状态算法；调用时机：Editor 初始化或复用后。 */
const showDatabaseRowPreview = (model: EditorDomain, blockID: string) => {
    if (!model.editor.protyle.contentElement) {
        throw new Error("Database row preview requires an initialized editor content element");
    }
    model.editor.protyle.element.dataset.databaseRowId = blockID;
    model.editor.protyle.databaseAttributePanel?.expand();
    model.editor.protyle.contentElement.scrollTop = 0;
};

/** 作用：判断页签是否属于指定数据库行；意图：统一初始化和持久化页签识别；调用时机：遍历全部页签时。 */
const isDatabaseRowPreviewTab = (tab: ReturnType<typeof getAllTabs>[number], blockID: string) => {
    if (isEditorDomain(tab.model)) {
        return tab.model.editor.protyle.element.dataset.databaseRowId === blockID;
    }
    const initData = tab.headElement?.getAttribute("data-initdata");
    if (!initData) {
        return false;
    }
    try {
        const initObj = JSON.parse(initData);
        return typeof initObj === "object" && initObj !== null &&
            isDatabaseRowTabData(initObj) && initObj.databaseRowId === blockID;
    } catch (error) {
        console.warn("Failed to parse database row tab init data:", error);
        return false;
    }
};

/** 作用：查找同一数据库行预览；意图：刷新前后保持单一页签；调用时机：创建新预览前。 */
const getDatabaseRowPreviewTab = (blockID: string) => getAllTabs().find((tab) => isDatabaseRowPreviewTab(tab, blockID));

/** 作用：切换匹配页签并恢复预览；意图：分离页签复用分支；调用时机：查找预览页签后。 */
const restoreDatabaseRowPreviewTab = (tab: ReturnType<typeof getDatabaseRowPreviewTab>, blockID: string) => {
    if (!tab) {
        return false;
    }
    tab.parent.switchTab(tab.headElement);
    tab.parent.showHeading();
    // 未初始化页签只需切换；完整 Editor 还需恢复属性面板与滚动位置。
    if (isEditorDomain(tab.model)) {
        showDatabaseRowPreview(tab.model, blockID);
    }
    return true;
};

/** 打开或复用桌面端数据库行预览页签。 @同步豁免: UI构建 - 已打开页签必须在当前导航栈内立即切换；新页签仍通过既有异步打开实现启动。 */
export const openDatabaseRowBlock = (app: AppFacade, options: AppBlockNavigation) => {
    const databaseRowId = options.databaseRowId;
    if (!databaseRowId) {
        throw new Error("Database row navigation requires databaseRowId");
    }
    if (restoreDatabaseRowPreviewTab(getDatabaseRowPreviewTab(databaseRowId), databaseRowId)) {
        return;
    }
    void openFileById({
        app,
        id: options.id,
        position: "right",
        openNewTab: true,
        removeCurrentTab: false,
        zoomIn: options.zoomIn,
        action: options.action,
        /** Editor 初始化完成后立即投影数据库行预览身份与面板状态。 */
        afterOpen(model) {
            // 打开流程可能返回其它布局模型，只有完整 Editor 具备数据库属性面板。
            if (model && isEditorDomain(model)) {
                showDatabaseRowPreview(model, databaseRowId);
            }
        },
    });
};
