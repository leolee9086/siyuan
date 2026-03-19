/** 用途：菜单项构造器；使用范围：width/height 顶层菜单项创建；解耦评估：组件能力统一来源。 */
import { MenuItem } from "./imports";
/** 用途：国际化文案；使用范围：width/height 顶层菜单标签；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";

/** 用途：构建 width 子菜单列表；使用范围：genWidthItem 导出函数；解耦评估：宽度逻辑独立子目录维护。 */
import { 构建宽度子菜单 } from "./sizeMenu/protyle.imgMenu.size.width";
/** 用途：构建 height 子菜单列表；使用范围：genHeightItem 导出函数；解耦评估：高度逻辑独立子目录维护。 */
import { 构建高度子菜单 } from "./sizeMenu/protyle.imgMenu.size.height";
/** 用途：宽高菜单上下文类型；使用范围：保存滑杆输入框引用；解耦评估：类型定义迁移到 sizeMenu 子目录。 */
import type { 图片尺寸菜单上下文 } from "./sizeMenu/protyle.imgMenu.size.types";

/**
 * 作用：生成 width 菜单项。
 * 意图：聚合宽度输入、预设比例和滑杆三类调整方式。
 * 调用时机：imgMenu 编辑态菜单构建阶段。
 * 问题/改进：后续可引入用户自定义预设比例。
 */
/** @同步豁免: UI构建 */
export const genWidthItem = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    imgElement: HTMLImageElement,
    assetElement: HTMLElement
) => {
    const id = nodeElement.getAttribute("data-node-id") || "";
    const html = nodeElement.outerHTML;
    const context: 图片尺寸菜单上下文 = { rangeElement: null };
    return new MenuItem({
        id: "width",
        label: siyuanI18n.width,
        submenu: 构建宽度子菜单(context, protyle, nodeElement, imgElement, assetElement, id, html)
    });
};

/**
 * 作用：生成 height 菜单项。
 * 意图：聚合高度输入、预设比例和滑杆三类调整方式。
 * 调用时机：imgMenu 编辑态菜单构建阶段。
 * 问题/改进：后续可引入用户自定义预设比例。
 */
/** @同步豁免: UI构建 */
export const genHeightItem = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    imgElement: HTMLImageElement,
    assetElement: HTMLElement
) => {
    const id = nodeElement.getAttribute("data-node-id") || "";
    const html = nodeElement.outerHTML;
    const context: 图片尺寸菜单上下文 = { rangeElement: null };
    return new MenuItem({
        id: "height",
        label: siyuanI18n.height,
        submenu: 构建高度子菜单(context, protyle, nodeElement, imgElement, assetElement, id, html)
    });
};
