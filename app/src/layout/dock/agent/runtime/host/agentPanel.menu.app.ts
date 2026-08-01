/** 用途：创建主应用原生菜单项；使用范围：仅 App 宿主菜单能力；解耦评估：经宿主网关收口，面板核心只调用聚合能力。 */
import {MenuItem} from "./imports";
/** 用途：约束菜单动作输入；使用范围：仅本 App 适配器；解耦评估：纯类型依赖，不引入面板运行时实现。 */
import type {PanelMenuItem} from "./imports";

/** 使用主应用公共 Menu 渲染并定位一组面板动作。 */
export function showAppPanelMenu(name: string, anchor: HTMLElement, items: PanelMenuItem[]) {
    const menu = window.siyuan.menus?.menu;
    if (!menu) {
        return;
    }
    menu.remove();
    menu.element.setAttribute("data-name", name);
    for (const item of items) {
        menu.append(new MenuItem({
            label: item.label,
            click: item.click,
            ...(item.icon ? {icon: item.icon} : {}),
            ...(item.current === undefined ? {} : {current: item.current}),
            ...(item.warning === undefined ? {} : {warning: item.warning}),
            ...(item.disabled === undefined ? {} : {disabled: item.disabled}),
        }).element);
    }
    const rect = anchor.getBoundingClientRect();
    menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
}

/** 关闭指定业务持有的公共菜单，避免误关其它模块刚打开的菜单。 */
export function closeAppPanelMenu(name?: string) {
    const menu = window.siyuan.menus?.menu;
    if (!menu) {
        return;
    }
    if (!name || menu.element.getAttribute("data-name") === name) {
        menu.remove();
    }
}
