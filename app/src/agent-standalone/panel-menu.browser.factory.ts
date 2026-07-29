/** 用途：复用支持独立宿主的公共菜单；使用范围：浏览器 PanelMenuPort；解耦评估：工厂集中实例化后只向调用方暴露 Port。 */
import {Menu} from "./imports";
/** 用途：创建公共菜单项；使用范围：浏览器 PanelMenuPort；解耦评估：菜单渲染细节封装在本工厂内。 */
import {MenuItem} from "./imports";
/** 用途：约束浏览器菜单适配器输入；使用范围：浏览器 PanelMenuPort。 */
import type {PanelMenuItem} from "./imports";

/** 创建独立 WebUI 使用的公共菜单 Port，使聊天面板可显示上传和目录权限动作。 */
/** @同步豁免: UI构建 */
export const createBrowserPanelMenuPort = () => {
    const menu = new Menu({closeOnOutsideClick: true});
    return {
        /** 将当前动作集合渲染到锚点下方，每次打开前释放上一次菜单状态。 */
        popup(name: string, anchor: HTMLElement, items: PanelMenuItem[]) {
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
        },
        /** 按可选持有者名称关闭菜单，避免面板销毁时影响其它公共菜单。 */
        close(name?: string) {
            // 未指定持有者时执行全量清理；指定名称时避免误关其它业务刚打开的菜单。
            if (!name || menu.element.getAttribute("data-name") === name) {
                menu.remove();
            }
        },
    };
};
