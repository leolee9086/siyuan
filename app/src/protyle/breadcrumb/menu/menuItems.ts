/**
 * 面包屑菜单项辅助函数
 * 从 showBreadcrumbMenu.ts 提取的菜单项创建函数
 */
import { fetchPost } from "../../../util/network/fetch";
import { Constants } from "../../../constants";
import { Menu } from "../../../menus/Menu";
import { MenuItem } from "../../../menus/Menu.Item";
import { net2LocalAssets } from "../action";
import { needSubscribe } from "../../../util/platform/needSubscribe";
import { confirmDialog } from "../../../dialog/confirmDialog";
import { getCloudURL } from "../../../config/util/about";
import { openFile } from "../../../editor/util";
import { EXPORT_PREVIEW_TAB_TYPE } from "../../../export-preview/constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, hasSiyuanUser } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

// ==================== 菜单项辅助函数 ====================

/**
 * 作用：向面包屑菜单追加"网络图片转本地""网络资源转本地""上传资源到CDN""分享到链滴"四组资源管理菜单项
 * 意图：将资源转换/上传/分享操作集中在面包屑菜单中，方便用户对当前文档的资源进行批量操作
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在文档非只读状态下调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
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
        /** 作用：将文档中的网络图片下载为本地资源 | 调用时机：用户点击菜单项时 */
        click() {
            net2LocalAssets(protyle, "Img");
        }
    }).element);

    menu.append(new MenuItem({
        id: "netAssets2LocalAssets",
        label: siyuanI18n.netAssets2LocalAssets,
        icon: "iconTransform",
        accelerator: siyuanConfig.keymap.editor.general.netAssets2LocalAssets.custom,
        /** 作用：将文档中的所有网络资源下载为本地资源 | 调用时机：用户点击菜单项时 */
        click() {
            net2LocalAssets(protyle, "Assets");
        }
    }).element);

    menu.append(new MenuItem({
        id: "uploadAssets2CDN",
        label: siyuanI18n.uploadAssets2CDN,
        icon: "iconCloudSucc",
        /** 作用：将文档资源上传到思源CDN | 调用时机：用户点击菜单项时 */
        click() {
            // 未订阅用户会弹出订阅提示，已订阅用户弹出确认对话框后执行上传
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
            /** 作用：将文档分享到链滴社区 | 调用时机：用户点击菜单项时 */
            click() {
                confirmDialog("🤩 " + siyuanI18n.share2Liandi,
                    siyuanI18n.share2LiandiConfirmTip.replace("${accountServer}", getCloudURL("")), () => {
                        fetchPost("/api/export/export2Liandi", { id: protyle.block.parentID });
                    });
            }
        }).element);
    }
}

/**
 * 作用：在面包屑菜单中添加"打开导出预览"顶级菜单项
 * 意图：preview 已从 protyle 编辑模式剥离为独立页签，此菜单项替代原"编辑模式"子菜单中的"预览"选项
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加导出预览菜单项(
    protyle: IProtyle,
    menu: Menu,
    siyuanConfig: ReturnType<typeof getSiyuanConfig>
): void {
    const item = new MenuItem({
        id: "openExportPreview",
        icon: "iconPreview",
        label: siyuanI18n.preview,
        accelerator: siyuanConfig.keymap.editor.general.preview.custom,
        /** 作用：打开导出预览页签 | 调用时机：用户点击菜单项时 */
        async click() {
            await openFile({
                app: protyle.app,
                custom: {
                    title: siyuanI18n.preview,
                    icon: "iconPreview",
                    id: EXPORT_PREVIEW_TAB_TYPE,
                    data: { blockId: protyle.block.rootID },
                },
            });
        }
    });
    menu.append(item.element);
}

/**
 * 作用：向面包屑菜单追加"只读模式"子菜单，包含"启用"和"禁用"两个选项
 * 意图：允许用户在面包屑菜单中快速切换当前文档的只读属性
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在非全局只读且 wysiwyg 存在时调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
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
            /** 作用：将文档只读属性设为 true | 调用时机：用户点击"启用"时 */
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
            /** 作用：将文档只读属性设为 false | 调用时机：用户点击"禁用"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_READONLY]: "false" }
                });
            }
        }]
    }).element);
}

/**
 * 作用：向面包屑菜单追加"全宽模式"子菜单，包含"启用""禁用""默认"三个选项
 * 意图：允许用户在面包屑菜单中快速切换当前文档的全宽显示属性
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在桌面端非只读且 wysiwyg 存在时调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
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
            /** 作用：将文档全宽属性设为 true | 调用时机：用户点击"启用"时 */
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
            /** 作用：将文档全宽属性设为 false | 调用时机：用户点击"禁用"时 */
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
            /** 作用：清除文档全宽属性，恢复默认行为 | 调用时机：用户点击"默认"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "" }
                });
            }
        }]
    }).element);
}
