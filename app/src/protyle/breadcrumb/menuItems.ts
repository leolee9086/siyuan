/**
 * 面包屑菜单项辅助函数
 * 从 showBreadcrumbMenu.ts 提取的菜单项创建函数
 */
import { fetchPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { Menu } from "../../menus/Menu";
import { MenuItem } from "../../menus/Menu.Item";
import { net2LocalAssets } from "./action";
import { setEditMode } from "../util/setEditMode";
import { needSubscribe } from "../../util/needSubscribe";
import { saveLayout } from "../../layout/util";
import { isMobile } from "../../platform";
import { onGet } from "../util/onGet";
import { confirmDialog } from "../../dialog/confirmDialog";
import { getCloudURL } from "../../config/util/about";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanMenus, hasSiyuanUser } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// 重导出上传和录音菜单项函数
export { 添加上传菜单项, 添加录音菜单项 } from "./menuItems.upload";

// ==================== 菜单项辅助函数 ====================

export function 添加资源转换菜单项(
    protyle: IProtyle,
    menu: Menu,
    siyuanConfig: ReturnType<typeof getSiyuanConfig>
): void {
    menu.append(new MenuItem({
        id: "netImg2LocalAsset",
        label: siyuanI18n.netImg2LocalAsset,
        icon: "iconImgDown",
        accelerator: siyuanConfig.keymap.editor.general.netImg2LocalAsset.custom,
        click() {
            net2LocalAssets(protyle, "Img");
        }
    }).element);

    menu.append(new MenuItem({
        id: "netAssets2LocalAssets",
        label: siyuanI18n.netAssets2LocalAssets,
        icon: "iconTransform",
        accelerator: siyuanConfig.keymap.editor.general.netAssets2LocalAssets.custom,
        click() {
            net2LocalAssets(protyle, "Assets");
        }
    }).element);

    menu.append(new MenuItem({
        id: "uploadAssets2CDN",
        label: siyuanI18n.uploadAssets2CDN,
        icon: "iconCloudSucc",
        click() {
            if (!needSubscribe()) {
                confirmDialog("📦 " + siyuanI18n.uploadAssets2CDN, siyuanI18n.uploadAssets2CDNConfirmTip, () => {
                    fetchPost("/api/asset/uploadCloud", { id: protyle.block.id });
                });
            }
        }
    }).element);

    // 分享到链滴（需要登录）
    const user = hasSiyuanUser();
    if (user) {
        menu.append(new MenuItem({
            id: "share2Liandi",
            label: siyuanI18n.share2Liandi,
            icon: "iconLiandi",
            click() {
                confirmDialog("🤩 " + siyuanI18n.share2Liandi,
                    siyuanI18n.share2LiandiConfirmTip.replace("${accountServer}", getCloudURL("")), () => {
                        fetchPost("/api/export/export2Liandi", { id: protyle.block.parentID });
                    });
            }
        }).element);
    }
}

function 处理所见即所得响应(protyle: IProtyle, response: IWebSocketData) {
    onGet({
        data: response,
        protyle,
        action: protyle.block.id === protyle.block.rootID
            ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HTML, Constants.CB_GET_UNUNDO]
            : [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO, Constants.CB_GET_HTML]
    });
}

export function 添加编辑模式菜单项(
    protyle: IProtyle,
    menu: Menu,
    siyuanConfig: ReturnType<typeof getSiyuanConfig>
): void {
    menu.append(new MenuItem({
        id: "editMode",
        icon: "iconEdit",
        label: siyuanI18n["edit-mode"],
        type: "submenu",
        submenu: [{
            id: "wysiwyg",
            current: protyle.contentElement ? !protyle.contentElement.classList.contains("fn__none") : false,
            label: siyuanI18n.wysiwyg,
            accelerator: siyuanConfig.keymap.editor.general.wysiwyg.custom,
            click: () => {
                setEditMode(protyle, "wysiwyg");
                if (protyle.scroll) {
                    protyle.scroll.lastScrollTop = 0;
                }
                fetchPost("/api/filetree/getDoc", {
                    id: protyle.block.id,
                    size: protyle.block.id === protyle.block.rootID ? siyuanConfig.editor.dynamicLoadBlocks : Constants.SIZE_GET_MAX,
                }, (response) => {
                    处理所见即所得响应(protyle, response);
                });
                if (!isMobile) {
                    saveLayout();
                }
            }
        }, {
            id: "preview",
            current: protyle.preview ? !protyle.preview.element.classList.contains("fn__none") : false,
            icon: "iconPreview",
            label: siyuanI18n.preview,
            accelerator: siyuanConfig.keymap.editor.general.preview.custom,
            click: () => {
                setEditMode(protyle, "preview");
                getSiyuanMenus()?.menu.remove();
                if (!isMobile) {
                    saveLayout();
                }
            }
        }]
    }).element);
}

export function 添加只读模式菜单项(
    protyle: IProtyle,
    menu: Menu
): void {
    const isCustomReadonly = protyle.wysiwyg?.element.getAttribute(Constants.CUSTOM_SY_READONLY);

    menu.append(new MenuItem({
        id: "editReadonly",
        label: siyuanI18n.editReadonly,
        icon: "iconLock",
        type: "submenu",
        submenu: [{
            id: "enable",
            iconHTML: "",
            current: isCustomReadonly === "true",
            label: siyuanI18n.enable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_READONLY]: "true" }
                });
            }
        }, {
            id: "disable",
            iconHTML: "",
            current: !isCustomReadonly || isCustomReadonly === "false",
            label: siyuanI18n.disable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_READONLY]: "false" }
                });
            }
        }]
    }).element);
}

export function 添加全宽模式菜单项(
    protyle: IProtyle,
    menu: Menu
): void {
    const isCustomFullWidth = protyle.wysiwyg?.element.getAttribute(Constants.CUSTOM_SY_FULLWIDTH);

    menu.append(new MenuItem({
        id: "fullWidth",
        label: siyuanI18n.fullWidth,
        icon: "iconDock",
        type: "submenu",
        submenu: [{
            id: "enable",
            iconHTML: "",
            current: isCustomFullWidth === "true",
            label: siyuanI18n.enable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "true" }
                });
            }
        }, {
            id: "disable",
            iconHTML: "",
            current: isCustomFullWidth === "false",
            label: siyuanI18n.disable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "false" }
                });
            }
        }, {
            id: "default",
            iconHTML: "",
            current: !isCustomFullWidth,
            label: siyuanI18n.default,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "" }
                });
            }
        }]
    }).element);
}
