/**
 * @fileoverview 固定搜索相关点击处理
 */

import {setStorageVal} from "../../../../util/storage/setStorageVal";
import { MenuItem } from "../../../../menus/Menu.Item";
import { genUUID } from "../../../../util/platform/genID";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 处理固定搜索点击
 */
export function handleSearchPin(
    target: HTMLElement,
    element: HTMLElement,
    searchInputElement: HTMLInputElement
): void {
    const uuid = genUUID();
    const query = searchInputElement.value;
    const title = query || "Search Results";

    window.siyuan.menus.menu.remove();

    // 静态固定 - 固定当前搜索结果
    window.siyuan.menus.menu.append(new MenuItem({
        label: siyuanI18n.pinSearchResult || "Pin Search Result (Static)",
        iconHTML: "",
        click: () => {
            const ids: string[] = [];
            const listElement = element.querySelector("#searchList");
            if (listElement) {
                listElement.querySelectorAll("[data-node-id]").forEach((item) => {
                    ids.push(item.getAttribute("data-node-id") || "");
                });
            }
            if (ids.length === 0) {
                return;
            }

            const type = "custom_list:static:" + uuid;
            // 保存数据
            if (!window.siyuan.storage["local-customlists"]) {
                window.siyuan.storage["local-customlists"] = {};
            }
            window.siyuan.storage["local-customlists"][uuid] = {
                id: uuid,
                title: title,
                icon: "iconList",
                type: "static",
                target: ids
            };
            setStorageVal("local-customlists", window.siyuan.storage["local-customlists"]);

            // 添加到 Dock
            const dock = window.siyuan.layout.leftDock || window.siyuan.layout.rightDock;
            if (dock) {
                dock.addCustomItem({
                    type: type,
                    title: title,
                    icon: "iconList",
                    show: true,
                    size: { width: 300, height: 0 },
                    hotkey: "",
                });
            }
        }
    }).element);

    // 动态固定 - 固定搜索查询
    window.siyuan.menus.menu.append(new MenuItem({
        label: siyuanI18n.pinSearchQuery || "Pin Search Query (Dynamic)",
        iconHTML: "",
        click: () => {
            const type = "custom_list:dynamic:" + uuid;
            // 保存数据
            if (!window.siyuan.storage["local-customlists"]) {
                window.siyuan.storage["local-customlists"] = {};
            }
            window.siyuan.storage["local-customlists"][uuid] = {
                id: uuid,
                title: title,
                icon: "iconSearch",
                type: "dynamic",
                target: query
            };
            setStorageVal("local-customlists", window.siyuan.storage["local-customlists"]);

            // 添加到 Dock
            const dock = window.siyuan.layout.leftDock || window.siyuan.layout.rightDock;
            if (dock) {
                dock.addCustomItem({
                    type: type,
                    title: title,
                    icon: "iconSearch",
                    show: true,
                    size: { width: 300, height: 0 },
                    hotkey: "",
                });
            }
        }
    }).element);

    const rect = target.getBoundingClientRect();
    window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
}
