/** 用途：全局菜单实例。使用范围：dock 模块管理菜单。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：菜单项构造器。使用范围：dock 模块构建菜单项。解耦评估：同目录组件，直接同层导入。 */
import { MenuItem } from "./Menu.Item";
/** 用途：应用常量。使用范围：dock 模块菜单标识。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";

/**
 * 创建移动菜单项
 * @作用 根据 label 创建对应方向的 dock 移动菜单项
 * @调用时机 构建 dock 右键菜单时
 */
const moveMenuItem = (label: string, target: Element) => {
    const win = document.defaultView;
    if (!win) {
        return null;
    }
    const siyuan = win.siyuan;
    if (!siyuan) {
        return null;
    }
    return new MenuItem({
        id: label,
        label: siyuan.languages[label],
        icon: label.replace("moveTo", "icon"),
        /** 执行 dock 移动操作 */
        click: () => {
            // 左 dock 移动：根据 Top/Bottom 选择位置
            if (label.indexOf("moveToLeft") > -1) {
                siyuan.layout.leftDock.add(label.endsWith("Top") ? 0 : 1, target);
                return;
            }
            // 右 dock 移动：根据 Top/Bottom 选择位置
            if (label.indexOf("moveToRight") > -1) {
                siyuan.layout.rightDock.add(label.endsWith("Top") ? 0 : 1, target);
                return;
            }
            // 底部 dock 移动：根据 Left/Right 选择位置
            if (label.indexOf("moveToBottom") > -1) {
                siyuan.layout.bottomDock.add(label.endsWith("Left") ? 0 : 1, target);
            }
        }
    });
};

/**
 * 初始化 dock 右键菜单
 * @作用 为目标元素生成 dock 位置移动菜单
 * @调用时机 用户右键点击 dock 元素时
 * @同步豁免: UI构建 — 菜单在同步调用栈中组装并弹出
 */
export const initDockMenu = (target: Element) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_DOCK);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToLeftTop", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToLeftBottom", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToRightTop", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToRightBottom", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToBottomLeft", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToBottomRight", target).element);
    return getSiyuanGlobalMenusMenu();
};
