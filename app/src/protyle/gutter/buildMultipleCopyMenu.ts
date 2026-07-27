/**
 * 多选块复制菜单构建模块
 * 从 buildGutterMultipleMenu.ts 拆分而来
 */
import { MenuItem } from "../../menus/Menu.Item";
import {copySubMenu} from "../../menus/commonMenuItem/copy/copySubMenu.factory";
import { copyPlainText } from "../util/compatibility";
import { focusBlock, focusByRange, getEditorRange } from "../util/selection";
import { isNotEditBlock } from "../wysiwyg/getBlock";
import { duplicateBlock } from "../wysiwyg/commonHotkey/commonHotkey";
import { getPlainText } from "../util/paste";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { genCopyTextRef } from "./buildGutterCopyMenu";

/**
 * 生成复制纯文本菜单项
 */
const 生成复制纯文本菜单项 = (selectsElement: Element[], 第一个选中元素: Element): IMenu => ({
    id: "copyPlainText",
    iconHTML: "",
    label: siyuanI18n.copyPlainText,
    accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
    click() {
        let html = "";
        for (const item of selectsElement) {
            html += getPlainText(item as HTMLElement) + "\n";
        }
        copyPlainText(html.trimEnd());
        focusBlock(第一个选中元素);
    }
});

/**
 * 生成复制菜单项
 */
const 生成复制菜单项 = (selectsElement: Element[]): IMenu => ({
    id: "copy",
    iconHTML: "",
    label: siyuanI18n.copy,
    accelerator: "⌘C",
    click() {
        const 第一个元素 = selectsElement[0];
        if (!第一个元素) {
            return;
        }
        if (isNotEditBlock(第一个元素)) {
            focusBlock(第一个元素);
            document.execCommand("copy");
            return;
        }
        focusByRange(getEditorRange(第一个元素));
        document.execCommand("copy");
    }
});

/**
 * 生成副本菜单项
 */
const 生成副本菜单项 = (protyle: IProtyle, selectsElement: Element[]): IMenu => ({
    id: "duplicate",
    iconHTML: "",
    label: siyuanI18n.duplicate,
    accelerator: getSiyuanConfig().keymap.editor.general.duplicate.custom,
    click() {
        duplicateBlock(selectsElement, protyle);
    }
});

/**
 * 构建复制菜单
 */
export const 构建复制菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    const 第一个选中元素 = selectsElement[0];
    if (!第一个选中元素) {
        return;
    }

    // @内联回调
    const nodeIds = Array.from(selectsElement).map(item => item.getAttribute("data-node-id"));
    const baseMenu = copySubMenu(nodeIds, true, 第一个选中元素);

    const copyMenu: IMenu[] = baseMenu.concat([
        生成复制纯文本菜单项(selectsElement, 第一个选中元素),
        生成复制菜单项(selectsElement)
    ]);

    const copyTextRefMenu = genCopyTextRef(Array.from(selectsElement));
    if (copyTextRefMenu) {
        copyMenu.splice(7, 0, copyTextRefMenu);
    }

    if (!protyle.disabled) {
        copyMenu.push(生成副本菜单项(protyle, selectsElement));
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu: copyMenu,
    }).element);
};
