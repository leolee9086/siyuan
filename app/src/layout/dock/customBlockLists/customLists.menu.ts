import { MenuItem } from "../../../menus/Menu.Item";
import { fetchPost } from "../../../util/fetch";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { forgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import { CustomLists } from "./CustomLists";
import { updateListTarget } from "./customLists.util";

// @ts-ignore
import { genSearch } from "../../../search/util";
import { Dialog } from "../../../dialog";
import { App } from "../../../index";
// @ts-ignore
import { Config } from "../../../types/index";

export const showCustomListMenu = (app: App, customList: CustomLists, event: MouseEvent) => {
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

        if (customList.listData.type === "dynamic") {
            window.siyuan.menus.menu.append(new MenuItem({
                iconHTML: "",
                label: (forgeI18n as any).customList?.savedCriteria || "Saved Criteria",
                type: "submenu",
                submenu: subMenus
            }).element);


            window.siyuan.menus.menu.append(new MenuItem({
                label: (forgeI18n as any).customList?.editSearchConditions || "Edit Search Conditions",
                iconHTML: "",
                click: () => {
                    const dialog = new Dialog({
                        title: (forgeI18n as any).customList?.editSearchConditions || "Edit Search Conditions",
                        content: `<div class="b3-dialog__content" style="height: 60vh; display: flex; flex-direction: column; padding: 0;">
                            <div id="searchContainer" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;"></div>
                            <div class="b3-dialog__action">
                                <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
                                <button class="b3-button b3-button--text" id="saveSearchBtn">${siyuanI18n.save}</button>
                            </div>
                        </div>`,
                        width: "80vw",
                        height: "70vh"
                    });

                    const searchContainer = dialog.element.querySelector("#searchContainer") as HTMLElement;
                    let currentConfig: Config.IUILayoutTabSearchConfig;
                    try {
                        currentConfig = JSON.parse(customList.listData.target);
                    } catch (e) {
                        currentConfig = {
                            k: "",
                            method: 0,
                        };
                    }

                    // Ensure searchContainer has a defined height for genSearch to calculate layout if needed
                    // genSearch clears innerHTML usually.

                    // Capture config updates
                    const updateCB = (config: Config.IUILayoutTabSearchConfig) => {
                        currentConfig = config;
                    };

                    genSearch(app, currentConfig, searchContainer, () => {
                        dialog.destroy();
                    }, updateCB);

                    const cancelBtn = dialog.element.querySelector(".b3-button--cancel");
                    cancelBtn.addEventListener("click", () => {
                        dialog.destroy();
                    });

                    const saveBtn = dialog.element.querySelector("#saveSearchBtn");
                    saveBtn.addEventListener("click", () => {
                        // Use currentConfig
                        customList.listData.target = JSON.stringify(currentConfig);
                        // Update title if needed? Usually dynamic list title assumes a name or query. 
                        // If it came from a saved criterion, it has a name. If ad-hoc, maybe update name to query?
                        // For now, keep existing title unless we want to auto-update it.
                        // But we should call updateTitle() without args? No, updateTitle updates DOM title from listData.

                        // We might want to clear the title if it was a saved criterion name and now it's modified?
                        // But let's keep it simple.
                        customList.updateTitle();
                        updateListTarget(customList.listData);
                        customList.update();
                        dialog.destroy();
                    });
                }
            }).element);
        }

        window.siyuan.menus.menu.popup({ x, y });
    });
};
