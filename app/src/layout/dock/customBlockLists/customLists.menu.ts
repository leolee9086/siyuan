import { MenuItem } from "../../../menus/Menu.Item";
import { fetchPost } from "../../../util/network/fetch";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { forgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import type {CustomListsDomain} from "./customLists.types";
import { updateListTarget } from "./customLists.helper";

import { genSearch } from "../../../search/utils/genSearch";
import { Dialog } from "../../../dialog";
import type { AppFacade } from "../../../app/AppFacade.types";

export const showCustomListMenu = (app: AppFacade, customList: CustomListsDomain, event: MouseEvent) => {
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
                label: forgeI18n.customList?.savedCriteria || "Saved Criteria",
                type: "submenu",
                submenu: subMenus
            }).element);


            window.siyuan.menus.menu.append(new MenuItem({
                label: forgeI18n.customList?.editSearchConditions || "Edit Search Conditions",
                iconHTML: "",
                click: () => {
                    const dialog = new Dialog({
                        title: forgeI18n.customList?.editSearchConditions || "Edit Search Conditions",
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

                    genSearch({app, config: currentConfig, element: searchContainer, closeCB: () => {
                        dialog.destroy();
                    }, updateCB});

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

        // 转换为嵌入数据集
        window.siyuan.menus.menu.append(new MenuItem({
            iconHTML: "",
            label: forgeI18n.customList?.convertToDataset || "转换为嵌入数据集",
            icon: "iconDatabase",
            click: () => {
                showConvertToDatasetDialog(app, customList);
            }
        }).element);

        window.siyuan.menus.menu.popup({ x, y });
    });
};

/**
 * 显示转换为嵌入数据集对话框
 */
const showConvertToDatasetDialog = (app: AppFacade, customList: CustomListsDomain) => {
    const defaultModel = "leolee9086/text2vec-base-chinese";
    const dialog = new Dialog({
        title: forgeI18n.customList?.convertToDataset || "转换为嵌入数据集",
        content: `<div class="b3-dialog__content">
            <div class="b3-label">
                <span>数据集名称</span>
                <input class="b3-text-field fn__block" id="datasetName" value="${customList.listData.title}">
            </div>
            <div class="b3-label">
                <span>嵌入模型</span>
                <select class="b3-select fn__block" id="modelSelect">
                    <option value="${defaultModel}" selected>${defaultModel}</option>
                </select>
            </div>
            <div class="b3-label">
                <span>模型维度</span>
                <input class="b3-text-field fn__block" id="modelDimension" value="768" readonly>
            </div>
        </div>
        <div class="b3-dialog__action">
            <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
            <button class="b3-button b3-button--text" id="confirmBtn">${siyuanI18n.confirm}</button>
        </div>`,
        width: "400px",
    });

    const nameInput = dialog.element.querySelector("#datasetName") as HTMLInputElement;
    const modelSelect = dialog.element.querySelector("#modelSelect") as HTMLSelectElement;
    const cancelBtn = dialog.element.querySelector(".b3-button--cancel");
    const confirmBtn = dialog.element.querySelector("#confirmBtn");

    cancelBtn?.addEventListener("click", () => {
        dialog.destroy();
    });

    // @内联回调
    confirmBtn?.addEventListener("click", () => {
        const datasetName = nameInput.value.trim() || customList.listData.title;
        const model = modelSelect.value;

        // 动态导入并调用添加数据集
        // @内联回调
        import("../embeddingDock/embeddingDock.api").then(({ 添加数据集 }) => {
            添加数据集({
                id: `ds_${Date.now().toString(36)}`,
                title: datasetName,
                icon: customList.listData.icon,
                type: customList.listData.type,
                target: customList.listData.target,
                model,
                scopeVersion: 1,
            });
            dialog.destroy();

            // 动态添加 EmbeddingDock 到侧边栏
            import("../../../util/siyuanEnvironments/getSiyuanConfig.environment").then(({ getSiyuanLayout }) => {
                const layout = getSiyuanLayout();
                if (!layout) {
                    return;
                }
                const dock = layout.leftDock || layout.rightDock;
                if (dock) {
                    dock.addCustomItem({
                        type: "embedding_dock",
                        title: "嵌入管理",
                        icon: "iconDatabase",
                        show: true,
                        size: { width: 300, height: 0 },
                        hotkey: "",
                        hotkeyLangId: "",
                    });
                }
            });
        });
    });
};
