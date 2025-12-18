import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
import { MenuItem } from "./Menu.Item";

const moveMenuItem = (label: string, target: Element) => {
    return new MenuItem({
        label: window.siyuan.languages[label],
        icon: label.replace("moveTo", "icon"),
        click: () => {
            if (label.indexOf("moveToLeft") > -1) {
                window.siyuan.layout.leftDock.add(label.endsWith("Top") ? 0 : 1, target);
                return;
            }
            if (label.indexOf("moveToRight") > -1) {
                window.siyuan.layout.rightDock.add(label.endsWith("Top") ? 0 : 1, target);
                return;
            }
            if (label.indexOf("moveToBottom") > -1) {
                window.siyuan.layout.bottomDock.add(label.endsWith("Left") ? 0 : 1, target);
            }
        }
    });
};

export const initDockMenu = (target: Element) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToLeftTop", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToLeftBottom", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToRightTop", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToRightBottom", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToBottomLeft", target).element);
    getSiyuanGlobalMenusMenu().append(moveMenuItem("moveToBottomRight", target).element);
    return getSiyuanGlobalMenusMenu();
};
