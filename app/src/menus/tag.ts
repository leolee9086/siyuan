/** 用途：创建标签菜单项；使用范围：重命名和删除命令；解耦评估：菜单领域唯一 DOM 实现，行为模块只调用集中创建入口。 */
import { MenuItem } from "./Menu.Item";
/** 用途：删除标签请求；使用范围：用户确认删除后；解耦评估：通用网络基础设施，不持有标签面板状态。 */
import {fetchPost} from "./imports";
/** 用途：显示删除确认；使用范围：标签删除命令；解耦评估：交互基础设施，删除流程需要等待用户决定。 */
import {confirmDialog} from "./imports";
/** 用途：转义确认文案中的标签名；使用范围：删除对话框 HTML；解耦评估：纯 DOM 安全工具。 */
import {escapeHtml} from "./imports";
/** 用途：执行统一标签重命名；使用范围：重命名菜单命令；解耦评估：标签业务操作唯一实现，不在菜单重复。 */
import {renameTag} from "./imports";
/** 用途：标签菜单标识常量；使用范围：重复触发关闭判断；解耦评估：稳定常量依赖，无状态回边。 */
import {Constants} from "./imports";

/**
 * 打开标签操作菜单。
 *
 * 由桌面或移动标签面板在更多按钮/右键事件中调用；删除成功后使用调用方提供的刷新能力，
 * 使菜单行为不依赖任何具体 Tag 面板 class。
 * @同步豁免: UI构建 - 菜单项必须在触发事件栈内同步挂载并定位。
 */
export const openTagMenu = (options: {
    event: MouseEvent;
    labelName: string;
    refresh: () => void;
}) => {
    const {event, labelName, refresh} = options;
    // 同一个标签菜单已显示时，再次触发表示关闭现有菜单而非重新创建。
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_TAG) {
        window.siyuan.menus.menu.remove();
        return;
    }
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.append(MenuItem.create({
        icon: "iconEdit",
        label: window.siyuan.languages.rename,
        /** 用户选择重命名时沿用统一标签重命名流程。 */
        click: () => {
            renameTag(labelName);
        }
    }).element);
    window.siyuan.menus.menu.append(MenuItem.create({
        icon: "iconTrashcan",
        label: window.siyuan.languages.remove,
        /** 用户选择删除时先确认，内核成功后刷新发起菜单的面板。 */
        click: () => {
            confirmDialog(window.siyuan.languages.deleteOpConfirm, `${window.siyuan.languages.confirmDelete} <b>${escapeHtml(labelName)}</b>?`, () => {
                fetchPost("/api/tag/removeTag", {label: labelName}, () => {
                    refresh();
                });
            }, undefined, true);
        }
    }).element);
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_TAG);
    window.siyuan.menus.menu.popup({x: event.clientX - 11, y: event.clientY + 11, h: 22, w: 12});
};
