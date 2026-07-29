/** 用途：创建主应用原生菜单项；使用范围：仅 App 宿主菜单 Port；解耦评估：经宿主网关收口，面板核心仅依赖 PanelMenuPort。 */
import {MenuItem} from "./imports";
/** 用途：约束菜单 Port 输入；使用范围：仅本 App 适配器；解耦评估：纯类型依赖，不引入面板运行时实现。 */
import type {PanelMenuItem} from "./imports";

/** 使用主应用公共 Menu 渲染并定位一组细粒度面板动作。 */
const popupAppPanelMenu = (name: string, anchor: HTMLElement, items: PanelMenuItem[]) => {
    const menu = window.siyuan.menus.menu;
    menu.remove();
    menu.element.setAttribute("data-name", name);
    for (const item of items) {
        menu.append(new MenuItem({
            label: item.label,
            icon: item.icon,
            current: item.current,
            warning: item.warning,
            disabled: item.disabled,
            click: item.click,
        }).element);
    }
    const rect = anchor.getBoundingClientRect();
    menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
};

/** 关闭指定业务持有的公共菜单，避免误关其它模块刚打开的菜单。 */
const closeAppPanelMenu = (name?: string) => {
    const menu = window.siyuan.menus.menu;
    // 未指定名称时无条件关闭；指定名称时仅释放本调用方持有的菜单。
    if (!name || menu.element.getAttribute("data-name") === name) {
        menu.remove();
    }
};

/**
 * 创建主应用菜单能力，使其它面板也能复用同一锚点菜单边界。
 * @同步豁免: UI构建 需要同步组装 capability，只返回已有函数引用，不执行异步业务。
 */
export const createAppPanelMenuPort = () => ({
    popup: popupAppPanelMenu,
    close: closeAppPanelMenu,
});
