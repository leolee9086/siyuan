import { MenuItem } from "../../../menus/Menu.Item";
import { fetchPost } from "../../../util/fetch";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { CustomLists } from "./CustomLists";
import { updateListTarget } from "./customLists.util";

export const showCustomListMenu = (customList: CustomLists, event: MouseEvent) => {
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.loading || "Loading...",
        type: "readonly",
    }).element);

    const x = event.clientX;
    const y = event.clientY;
    window.siyuan.menus.menu.popup({ x, y });

    // @内联回调
    fetchPost("/api/storage/getCriteria", {}, (response) => {
        window.siyuan.menus.menu.remove();

        const subMenus: IMenu[] = [];
        if (response.data && Array.isArray(response.data)) {
            for (const item of response.data) {
                subMenus.push({
                    iconHTML: "",
                    label: item.name,
                    click: () => {
                        customList.listData.target = JSON.stringify(item);
                        customList.updateTitle(item.name);
                        updateListTarget(customList.listData);
                        customList.update();
                    }
                });
            }
        }

        if (subMenus.length === 0) {
            subMenus.push({
                iconHTML: "",
                label: siyuanI18n.empty,
                type: "readonly",
            });
        }

        window.siyuan.menus.menu.append(new MenuItem({
            iconHTML: "",
            label: siyuanI18n.savedCriteria || "保存的查询条件",
            type: "submenu",
            submenu: subMenus
        }).element);

        // Append other potential menu items here if needed in the future

        window.siyuan.menus.menu.popup({ x, y });
    });
};
