/** 用途：菜单项构造器；使用范围：图片菜单资产动作项创建；解耦评估：UI 组件能力统一来源。 */
import { MenuItem } from "./imports";
/** 用途：读取国际化文案；使用范围：对齐菜单项标签；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：读取全局配置；使用范围：对齐动作快捷键文案；解耦评估：配置访问由环境层封装。 */
import { getSiyuanConfig } from "./imports";
/** 用途：图片居中对齐动作；使用范围：alignCenter 菜单项点击；解耦评估：对齐逻辑由热键层封装。 */
import { alignImgCenter } from "./imports";
/** 用途：图片左对齐动作；使用范围：alignLeft 菜单项点击；解耦评估：对齐逻辑由热键层封装。 */
import { alignImgLeft } from "./imports";
/** 用途：导出资源配置；使用范围：export 菜单项创建；解耦评估：资源导出能力由 util 集中维护。 */
import { exportAsset } from "./imports";
/** 用途：复制资源文件配置；使用范围：copyAsset 菜单项创建；解耦评估：资源复制能力由 util 集中维护。 */
import { copyAsset } from "./imports";

/**
 * 作用：读取“居中对齐”快捷键文案。
 * 意图：避免菜单构建处出现深层配置访问链。
 * 调用时机：创建 alignCenter 菜单项时。
 * 问题/改进：后续可与其它对齐快捷键合并成统一映射读取器。
 */
const 读取居中对齐快捷键 = () => {
    return getSiyuanConfig().keymap.editor.general.alignCenter.custom;
};

/**
 * 作用：读取“左对齐”快捷键文案。
 * 意图：与居中对齐保持一致的配置读取路径。
 * 调用时机：创建 alignLeft 菜单项时。
 * 问题/改进：后续可与其它对齐快捷键合并成统一映射读取器。
 */
const 读取左对齐快捷键 = () => {
    return getSiyuanConfig().keymap.editor.general.alignLeft.custom;
};

/**
 * 作用：执行图片居中对齐。
 * 意图：收敛点击处理入参组装，降低菜单配置复杂度。
 * 调用时机：alignCenter 菜单项点击时。
 * 问题/改进：当前仅处理单图，后续可扩展批量对齐。
 */
const 执行居中对齐 = (
    protyle: IProtyle,
    nodeElement: Element,
    assetElement: HTMLElement,
    id: string,
    html: string
) => {
    const selectedAssets = [assetElement];
    alignImgCenter(protyle, nodeElement, selectedAssets, id, html);
};

/**
 * 作用：执行图片左对齐。
 * 意图：与居中对齐保持同层封装，统一菜单层调用方式。
 * 调用时机：alignLeft 菜单项点击时。
 * 问题/改进：当前仅处理单图，后续可扩展批量对齐。
 */
const 执行左对齐 = (
    protyle: IProtyle,
    nodeElement: Element,
    assetElement: HTMLElement,
    id: string,
    html: string
) => {
    const selectedAssets = [assetElement];
    alignImgLeft(protyle, nodeElement, selectedAssets, id, html);
};

/**
 * 作用：构建导出菜单项配置。
 * 意图：把 util 返回配置集中在本层，便于后续扩展前置检查。
 * 调用时机：创建 export 菜单项时。
 * 问题/改进：后续可加入导出权限校验。
 */
const 构建导出配置 = (dataSrc: string) => {
    const menuConfig = exportAsset(dataSrc);
    return menuConfig;
};

/**
 * 作用：构建复制资源文件菜单项配置。
 * 意图：统一 copyAsset 配置入口，便于后续扩展平台分支逻辑。
 * 调用时机：创建 copyAsset 菜单项时。
 * 问题/改进：后续可增加不可用平台提示。
 */
const 构建复制资源配置 = (dataSrc: string) => {
    const menuConfig = copyAsset(dataSrc);
    return menuConfig;
};

/**
 * 作用：生成居中对齐菜单项。
 * 意图：为图片提供一键居中能力。
 * 调用时机：编辑态 imgMenu 菜单构建阶段。
 * 问题/改进：后续可扩展批量选中元素支持。
 */
/** @同步豁免: UI构建 */
export const genAlignCenterItem = (
    protyle: IProtyle,
    nodeElement: Element,
    assetElement: HTMLElement,
    id: string,
    html: string
) => {
    return new MenuItem({
        id: "alignCenter",
        icon: "iconAlignCenter",
        label: siyuanI18n.alignCenter,
        accelerator: 读取居中对齐快捷键(),
        click: 执行居中对齐.bind(null, protyle, nodeElement, assetElement, id, html)
    });
};

/**
 * 作用：生成左对齐菜单项。
 * 意图：为图片提供一键左对齐能力。
 * 调用时机：编辑态 imgMenu 菜单构建阶段。
 * 问题/改进：后续可扩展批量选中元素支持。
 */
/** @同步豁免: UI构建 */
export const genAlignLeftItem = (
    protyle: IProtyle,
    nodeElement: Element,
    assetElement: HTMLElement,
    id: string,
    html: string
) => {
    return new MenuItem({
        id: "alignLeft",
        icon: "iconAlignLeft",
        label: siyuanI18n.alignLeft,
        accelerator: 读取左对齐快捷键(),
        click: 执行左对齐.bind(null, protyle, nodeElement, assetElement, id, html)
    });
};

/**
 * 作用：生成导出资源菜单项。
 * 意图：复用 util 导出配置并统一菜单构建入口。
 * 调用时机：assets 资源路径场景下。
 * 问题/改进：后续可增加导出前确认或目标路径记忆。
 */
/** @同步豁免: UI构建 */
export const genExportItem = (dataSrc: string) => {
    const menuConfig = 构建导出配置(dataSrc);
    return new MenuItem(menuConfig);
};

/**
 * 作用：生成复制资源文件菜单项。
 * 意图：提供桌面端复制资源文件到系统剪贴板能力。
 * 调用时机：assets 资源且系统支持时。
 * 问题/改进：后续可补充失败提示与能力检测反馈。
 */
/** @同步豁免: UI构建 */
export const genCopyAssetItem = (dataSrc: string) => {
    const menuConfig = 构建复制资源配置(dataSrc);
    return new MenuItem(menuConfig);
};
