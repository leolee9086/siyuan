/** 用途：全局菜单实例。使用范围：dock 模块管理菜单。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：菜单项构造器。使用范围：dock 模块构建菜单项。解耦评估：同目录组件，直接同层导入。 */
import { MenuItem } from "./Menu.Item";
/** 用途：应用常量。使用范围：dock 模块菜单标识。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：请求 Agent Dock Tab 的浮窗副本。使用范围：Dock 图标右键菜单；解耦评估：能力通过 Port 注入，菜单不创建 Dialog。 */
import { requestOpenTabAsDialog } from "./imports";
/** 用途：校验 Dock 模型关联的 Tab 句柄。使用范围：浮窗菜单动作绑定；解耦评估：只依赖稳定 Tab 类型，不引入具体 Dock 类。 */
import { Tab } from "./imports";
/** 用途：在具体 Dock 布局树中按 data-id 查找 Tab。使用范围：模型缓存未建立时的菜单入口兜底。 */
import { getInstanceById } from "./imports";

/** 从 Dock 图标所属 Dock 的模型数据解析实际 Tab 句柄。 */
const getDockTab = (target: Element) => {
    const type = target.getAttribute("data-type");
    const tabId = target.getAttribute("data-id");
    if (!type) {
        return undefined;
    }
    const docks = [window.siyuan.layout.leftDock, window.siyuan.layout.rightDock, window.siyuan.layout.bottomDock];
    const dock = docks.find(item => item?.elements.some(elements => elements.contains(target)));
    const model = dock?.data[type];
    // Dock.data 在初始化和隐藏状态下可能只保存布尔标记，只有模型对象才能反向得到 Tab。
    if (!model || typeof model !== "object" || !("parent" in model)) {
        const instance = tabId && dock?.layout ? getInstanceById(tabId, dock.layout) : undefined;
        return instance instanceof Tab ? instance : undefined;
    }
    return model.parent instanceof Tab ? model.parent : undefined;
};

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
    // Agent Dock 的右键入口不经过普通 Tab header 菜单，因此在这里显式提供浮窗副本动作。
    const tab = getDockTab(target);
    // 仅 Agent Dock 当前注册了副本工厂，其他 Dock 等待各自的副本能力声明。
    if (target.getAttribute("data-type") === "agentChat" && tab) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "openAsPopover",
            label: window.siyuan.languages.refPopover,
            icon: "iconPictureInPicture",
            /** 将当前 Agent Tab 委托给浮窗 Port，保持菜单层不依赖 Dialog 实现。 */
            click: () => requestOpenTabAsDialog(tab),
        }).element);
    }
    return getSiyuanGlobalMenusMenu();
};
