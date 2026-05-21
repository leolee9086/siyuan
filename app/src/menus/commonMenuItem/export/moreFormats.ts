/**
 * 用途：导出菜单"更多"子菜单项构建函数
 * 使用范围：exportMd 函数中的"更多"子菜单
 * 解耦评估：中度耦合 - 依赖 imports.ts 中的工具函数
 */

/**
 * 用途：发送 POST 请求到后端 API
 * 使用范围：所有导出格式的菜单项 click 回调
 * 解耦评估：低耦合 - 标准 HTTP 工具，无需解耦
 */
import { fetchPost } from "../imports";

/**
 * 用途：隐藏消息提示
 * 使用范围：导出完成后隐藏"导出中"提示
 * 解耦评估：低耦合 - UI 反馈工具，无需解耦
 */
import { hideMessage } from "../imports";

/**
 * 用途：在移动端打开导出文件
 * 使用范围：导出完成后打开结果文件
 * 解耦评估：低耦合 - 平台适配工具，无需解耦
 */
import { saveExportFile } from "../imports";

/**
 * 用途：显示消息提示
 * 使用范围：导出开始时显示"导出中"提示
 * 解耦评估：低耦合 - UI 反馈工具，无需解耦
 */
import { showMessage } from "../imports";

/**
 * 用途：国际化文本资源
 * 使用范围：菜单项标签和提示文本
 * 解耦评估：低耦合 - 全局 i18n 资源，无需解耦
 */
import { siyuanI18n } from "../imports";

/**
 * 用途：创建 reStructuredText 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createReStructuredTextExportMenuItem = (id: string): IMenu => ({
    id: "exportReStructuredText",
    label: "reStructuredText",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportReStructuredText", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 AsciiDoc 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createAsciiDocExportMenuItem = (id: string): IMenu => ({
    id: "exportAsciiDoc",
    label: "AsciiDoc",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportAsciiDoc", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 Textile 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createTextileExportMenuItem = (id: string): IMenu => ({
    id: "exportTextile",
    label: "Textile",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportTextile", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 OPML 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createOPMLExportMenuItem = (id: string): IMenu => ({
    id: "exportOPML",
    label: "OPML",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportOPML", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 Org-Mode 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createOrgModeExportMenuItem = (id: string): IMenu => ({
    id: "exportOrgMode",
    label: "Org-Mode",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportOrgMode", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 MediaWiki 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createMediaWikiExportMenuItem = (id: string): IMenu => ({
    id: "exportMediaWiki",
    label: "MediaWiki",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportMediaWiki", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 ODT 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createODTExportMenuItem = (id: string): IMenu => ({
    id: "exportODT",
    label: "ODT",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportODT", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 RTF 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createRTFExportMenuItem = (id: string): IMenu => ({
    id: "exportRTF",
    label: "RTF",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportRTF", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建 EPUB 导出菜单项
 * 使用范围：exportMd 函数的"更多"子菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createEPUBExportMenuItem = (id: string): IMenu => ({
    id: "exportEPUB",
    label: "EPUB",
    iconHTML: "",
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportEPUB", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 用途：创建"更多"导出格式子菜单项
 * 使用范围：exportMd 函数的 Electron 环境菜单
 * 解耦评估：低耦合 - 仅依赖文档 ID
 */
/** @同步豁免: UI构建 */
export const createMoreFormatsMenuItem = (id: string): IMenu => ({
    id: "exportMore",
    label: siyuanI18n.more,
    icon: "iconMore",
    type: "submenu" as const,
    // @内联数组
    submenu: [
        createReStructuredTextExportMenuItem(id),
        createAsciiDocExportMenuItem(id),
        createTextileExportMenuItem(id),
        createOPMLExportMenuItem(id),
        createOrgModeExportMenuItem(id),
        createMediaWikiExportMenuItem(id),
        createODTExportMenuItem(id),
        createRTFExportMenuItem(id),
        createEPUBExportMenuItem(id),
    ]
});
