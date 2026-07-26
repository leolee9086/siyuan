/**
 * 图片对齐相关的帮助函数
 * 
 * 本模块提供编辑器中图片/资源的对齐功能，配合快捷键和右键菜单使用。
 */
import * as dayjs from "dayjs";
import {updateTransaction} from "../transaction/update";

/**
 * 将图片资源设置为居中对齐
 * 
 * @description
 * - 作用：将指定的图片/资源元素设置为居中对齐，通过设置 `minWidth: calc(100% - 0.1em)` 实现
 * - 意图：提供图片居中对齐的能力，与 `alignImgLeft` 配合实现图片对齐功能
 * - 调用时机：
 *   1. 用户按下居中对齐快捷键且有图片被选中时（keydown.format.ts）
 *   2. 用户在图片右键菜单中选择"居中"选项时（protyle.imgMenu.actions.ts）
 */
export const alignImgCenter = (protyle: IProtyle, nodeElement: Element, assetElements: Element[], id: string, html: string) => {
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    for (const item of assetElements) {
        if (item instanceof HTMLElement) {
            item.style.minWidth = "calc(100% - 0.1em)";
        }
    }
    updateTransaction(protyle, id, nodeElement.outerHTML, html);
};

/**
 * 将图片资源设置为左对齐（恢复默认对齐）
 * 
 * @description
 * - 作用：移除图片/资源元素的样式，恢复默认的左对齐状态
 * - 意图：提供图片左对齐的能力，与 `alignImgCenter` 配合实现图片对齐功能
 * - 调用时机：
 *   1. 用户按下左对齐快捷键且有图片被选中时（keydown.format.ts）
 *   2. 用户在图片右键菜单中选择"居左"选项时（protyle.imgMenu.actions.ts）
 */
export const alignImgLeft = (protyle: IProtyle, nodeElement: Element, assetElements: Element[], id: string, html: string) => {
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    for (const item of assetElements) {
        item.removeAttribute("style");
    }
    updateTransaction(protyle, id, nodeElement.outerHTML, html);
};
