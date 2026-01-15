import * as dayjs from "dayjs";
import { renameAsset } from "../editor/rename";
import { MenuItem } from "./Menu.Item";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { writeText } from "../protyle/util/compatibility";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { focusByWbr, focusBlock } from "../protyle/util/selection";
import { copyPNGByLink, exportAsset } from "./util";
import { alignImgCenter, alignImgLeft } from "../protyle/wysiwyg/commonHotkey/commonHotkey";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";

/**
 * @zh-CN
 * @作用: 生成复制菜单项
 * @意图: 提供复制 markdown 内容的功能
 * @调用时机: imgMenu
 */
export const genCopyItem = (protyle: IProtyle, assetElement: HTMLElement) => {
    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        accelerator: "⌘C",
        icon: "iconCopy",
        click() {
            let content = protyle.lute.BlockDOM2StdMd(assetElement.outerHTML);
            content = content.replace(/%20/g, " ");
            writeText(content);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成复制图片地址菜单项
 * @意图: 提供复制图片 src 的功能
 * @调用时机: imgMenu
 */
export const genCopyImageURLItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "copyImageURL",
        label: siyuanI18n.copy + " " + siyuanI18n.imageURL,
        icon: "iconLink",
        click() {
            writeText(imgElement.getAttribute("src") || "");
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成复制为PNG菜单项
 * @意图: 提供将非PNG图片转为PNG并复制的功能
 * @调用时机: imgMenu
 */
export const genCopyAsPNGItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "copyAsPNG",
        label: siyuanI18n.copyAsPNG,
        accelerator: window.siyuan.config.keymap.editor.general.copyBlockRef.custom,
        icon: "iconImage",
        click() {
            copyPNGByLink(imgElement.getAttribute("src") || "");
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成剪切菜单项
 * @意图: 提供剪切功能
 * @调用时机: imgMenu
 */
export const genCutItem = (protyle: IProtyle, assetElement: HTMLElement, nodeElement: Element, id: string, html: string, range: Range) => {
    return new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        click() {
            let content = protyle.lute.BlockDOM2StdMd(assetElement.outerHTML);
            content = content.replace(/%20/g, " ");
            writeText(content);
            assetElement.outerHTML = "<wbr>";
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
            focusByWbr(protyle.wysiwyg.element, range);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成删除菜单项
 * @意图: 提供删除功能
 * @调用时机: imgMenu
 */
export const genDeleteItem = (protyle: IProtyle, assetElement: HTMLElement, nodeElement: Element, id: string, html: string, range: Range) => {
    return new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        accelerator: "⌫",
        label: siyuanI18n.delete,
        click: function () {
            assetElement.outerHTML = "<wbr>";
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
            focusByWbr(protyle.wysiwyg.element, range);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成重命名菜单项
 * @意图: 提供重命名资源的功能
 * @调用时机: imgMenu
 */
export const genRenameItem = (imagePath: string) => {
    return new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        click() {
            renameAsset(imagePath);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成居中对齐菜单项
 * @意图: 提供图片居中对齐功能
 * @调用时机: imgMenu
 */
export const genAlignCenterItem = (protyle: IProtyle, nodeElement: Element, assetElement: HTMLElement, id: string, html: string) => {
    return new MenuItem({
        id: "alignCenter",
        icon: "iconAlignCenter",
        label: siyuanI18n.alignCenter,
        accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
        click() {
            alignImgCenter(protyle, nodeElement, [assetElement], id, html);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成左对齐菜单项
 * @意图: 提供图片左对齐功能
 * @调用时机: imgMenu
 */
export const genAlignLeftItem = (protyle: IProtyle, nodeElement: Element, assetElement: HTMLElement, id: string, html: string) => {
    return new MenuItem({
        id: "alignLeft",
        icon: "iconAlignLeft",
        label: siyuanI18n.alignLeft,
        accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
        click() {
            alignImgLeft(protyle, nodeElement, [assetElement], id, html);
        }
    });
};

/**
 * @zh-CN
 * @作用: 生成导出菜单项
 * @意图: 提供导出资源功能
 * @调用时机: imgMenu
 */
export const genExportItem = (dataSrc: string) => {
    return new MenuItem(exportAsset(dataSrc));
};
