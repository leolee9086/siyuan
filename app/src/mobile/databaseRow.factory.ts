/** 用途：数据库行导航数据契约；使用范围：移动数据库行工厂；解耦评估：经本目录网关直达完整 AppFacade 声明。 */
import type {AppDatabaseRowNavigation} from "./imports";
/** 用途：完整应用领域根；使用范围：移动数据库行工厂；解耦评估：经本目录网关直达抽象。 */
import type {AppFacade} from "./imports";
/** 用途：块打开动作协议；使用范围：绑定数据库行；解耦评估：经本目录网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：移动详情 Dialog；使用范围：分离数据库行；解耦评估：实例化集中在本工厂。 */
import {Dialog} from "./imports";
/** 用途：属性表唯一渲染实现；使用范围：分离数据库行；解耦评估：经网关直达真实实现。 */
import {renderAVAttribute} from "./imports";

/**
 * 作用：关闭当前存在的移动端数据库条目详情。
 * 意图：移动端同一时刻只保留一个全屏条目详情，避免 Dialog 叠加。
 * 调用时机：打开新的分离条目或切换到绑定条目前调用。
 */
const closeMobileDatabaseRow = () => {
    const dialogs = window.siyuan.dialogs;
    if (!dialogs) {
        throw new Error("Mobile database row navigation requires initialized dialogs");
    }
    for (let i = dialogs.length - 1; i >= 0; i--) {
        const dialog = dialogs[i];
        // 只销毁数据库行全屏详情，不影响其它同时存在的移动端 Dialog。
        if (dialog?.element.querySelector(".protyle-db-row--mobile")) {
            dialog.destroy();
            break;
        }
    }
};

/**
 * 作用：创建移动端全屏 Dialog 并渲染分离数据库条目属性。
 * 意图：分离条目没有可导航的绑定块，需要保留既有独立详情呈现。
 * 调用时机：完整移动数据库行导航识别到 `isDetached` 后调用。
 */
const openDetachedMobileDatabaseRow = (
    protyle: IProtyle,
    options: AppDatabaseRowNavigation,
    title: string,
) => {
    closeMobileDatabaseRow();
    const dialog = new Dialog({
        content: `<div class="protyle-db-row protyle-db-row--mobile">
    <div class="protyle-db-row__title"><svg><use xlink:href="#iconDatabase"></use></svg><span></span></div>
    <div class="custom-attr protyle-db-row__body"></div>
</div>`,
        width: "100vw",
        height: "100dvh",
        containerClassName: "b3-dialog__container--database-row",
        disableAnimation: true,
    });
    const rowElement = dialog.element.querySelector<HTMLElement>(".protyle-db-row");
    const titleElement = rowElement?.querySelector<HTMLElement>(".protyle-db-row__title span");
    const bodyElement = rowElement?.querySelector<HTMLElement>(".protyle-db-row__body");
    if (!rowElement || !titleElement || !bodyElement) {
        throw new Error("Mobile database row dialog is missing its required structure");
    }
    titleElement.textContent = title;
    renderAVAttribute(bodyElement, options.itemID, protyle, undefined, {
        avID: options.avID,
        itemID: options.itemID,
        valueID: options.valueID,
    });
};

/** 移动端数据库行导航：分离条目使用全屏详情，绑定条目重载主编辑器并展开属性。 @同步豁免: UI构建 - 当前点击栈必须立即关闭旧详情并创建或切换目标 UI。 */
export const openMobileDatabaseRow = (
    app: AppFacade,
    protyle: IProtyle,
    options: AppDatabaseRowNavigation,
) => {
    const title = options.title || window.siyuan.languages?.untitled;
    if (!title) {
        throw new Error("Mobile database row navigation requires a title or initialized languages");
    }
    if (options.isDetached) {
        openDetachedMobileDatabaseRow(protyle, options, title);
        return;
    }
    if (!options.boundBlockID) {
        return;
    }
    closeMobileDatabaseRow();
    if (!window.siyuan.menus) {
        throw new Error("Mobile database row navigation requires initialized menus");
    }
    window.siyuan.menus.menu.remove();
    app.openBlock({
        id: options.boundBlockID,
        action: [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS],
        zoomIn: true,
        databaseRowId: options.boundBlockID,
    });
};
