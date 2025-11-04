import { MenuItem } from "../menus/Menu.Item";
import { subMenu } from "../menus/Menu.subMenu";
import { getGlobalMenus } from "../util/siyuanEnvironments/getMenu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

export class EventBus<DetailType = any> {
    private eventTarget: EventTarget;

    constructor(name = "") {
        this.eventTarget = document.appendChild(document.createComment(name));
    }

    on(type: TEventBus, listener: (event: CustomEvent<DetailType>) => void) {
        this.eventTarget.addEventListener(type, listener );
    }

    once(type: TEventBus, listener: (event: CustomEvent<DetailType>) => void) {
        this.eventTarget.addEventListener(type, listener , {once: true});
    }

    off(type: TEventBus, listener: (event: CustomEvent<DetailType>) => void) {
        this.eventTarget.removeEventListener(type, listener );
    }

    emit(type: TEventBus, detail?: DetailType) {
        return this.eventTarget.dispatchEvent(new CustomEvent(type, {detail, cancelable: true}));
    }
}

export const emitOpenMenu = (options: {
    plugins: import("./index").Plugin[],
    type: TEventBus,
    detail: any,
    separatorPosition?: "top" | "bottom",
}) => {
    const pluginSubMenu = new subMenu();
    options.detail.menu = pluginSubMenu;
    options.plugins.forEach((plugin) => {
        plugin.eventBus.emit(options.type, options.detail);
    });
    if (pluginSubMenu.menus.length > 0) {
        if (options.separatorPosition === "top") {
            getGlobalMenus().menu.append(new MenuItem({id: "separator_pluginTop", type: "separator"}).element);
        }
        getGlobalMenus().menu.append(new MenuItem({
            id: "plugin",
            label: siyuanI18n.plugin,
            icon: "iconPlugin",
            type: "submenu",
            submenu: pluginSubMenu.menus,
        }).element);
        if (options.separatorPosition === "bottom") {
            getGlobalMenus().menu.append(new MenuItem({id: "separator_pluginBottom", type: "separator"}).element);
        }
    }
};
