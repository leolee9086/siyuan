/**
 * 用途：exportMd 菜单项构建函数集合
 * 使用范围：exportMd 函数中使用
 * 解耦评估：将大型菜单构建逻辑拆分为独立函数，提高可维护性
 */

/**
 * 用途：发送异步 POST 请求到后端 API
 * 使用范围：所有导出菜单项的后端通信
 * 解耦评估：网络请求是基础设施层，无法解耦，必须直接导入
 */
import { fetchPost } from "../imports";
/**
 * 用途：隐藏消息提示
 * 使用范围：导出完成后隐藏"导出中"提示
 * 解耦评估：消息提示是全局UI组件，无法通过事件解耦，必须直接导入
 */
import { hideMessage } from "../imports";
/**
 * 用途：在移动端打开导出文件
 * 使用范围：导出完成后打开文件
 * 解耦评估：移动端特定功能，无法通过参数传递解耦，必须直接导入
 */
import { saveExportFile } from "../imports";
/**
 * 用途：保存导出文件到本地
 * 使用范围：Electron 环境的 PDF/HTML/Word 导出
 * 解耦评估：文件保存是平台特定功能，无法解耦，必须直接导入
 */
import { saveExport } from "../imports";
/**
 * 用途：显示消息提示
 * 使用范围：导出开始和完成时的用户反馈
 * 解耦评估：消息提示是全局UI组件，无法通过事件解耦，必须直接导入
 */
import { showMessage } from "../imports";
/**
 * 用途：获取国际化文本
 * 使用范围：所有菜单项的标签和提示文本
 * 解耦评估：国际化是全局配置，无法解耦，必须直接导入
 */
import { siyuanI18n } from "../imports";
/**
 * 用途：统一打开导出预览页签
 * 使用范围：笔记级图片导出入口切换到图片导出预览 tab
 * 解耦评估：导出预览 tab 的复用与类型切换收敛到单点，更便于兼容已有预览页签
 */
import { openExportPreviewTab } from "../../../export-preview/open";

/**
 * 作用：创建 SiYuan .sy.zip 导出菜单项
 * 意图：提供导出为 SiYuan 格式的功能
 * 调用时机：在 exportMd 函数中构建导出菜单时调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns SiYuan 导出菜单项配置对象
 */
export const createSiYuanZipExportMenuItem = (id: string): IMenu => ({
    id: "exportSiYuanZip",
    label: "SiYuan .sy.zip",
    icon: "iconSiYuan",
    /**
     * 作用：处理 SiYuan 格式导出点击事件
     * 意图：调用后端 API 导出文档为 .sy.zip 格式
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportSY", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 作用：创建 Markdown .zip 导出菜单项
 * 意图：提供导出为 Markdown 格式的功能
 * 调用时机：在 exportMd 函数中构建导出菜单时调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns Markdown 导出菜单项配置对象
 */
export const createMarkdownZipExportMenuItem = (id: string): IMenu => ({
    id: "exportMarkdown",
    label: "Markdown .zip",
    icon: "iconMarkdown",
    /**
     * 作用：处理 Markdown 格式导出点击事件
     * 意图：调用后端 API 导出文档为 Markdown .zip 格式
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        fetchPost("/api/export/exportMd", {
            id,
        }, response => {
            hideMessage(msgId);
            saveExportFile(response.data.zip);
        });
    }
});

/**
 * 作用：创建图片导出菜单项
 * 意图：提供导出为图片的功能
 * 调用时机：在 exportMd 函数中构建导出菜单时调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns 图片导出菜单项配置对象
 */
export const createImageExportMenuItem = (id: string): IMenu => ({
    id: "exportImage",
    label: siyuanI18n.image,
    icon: "iconImage",
    /**
     * 作用：处理图片导出点击事件
     * 意图：笔记级导出改为直接打开导出预览 tab，并进入图片预览类型
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        void openExportPreviewTab({
            blockId: id,
            previewType: "image",
        });
    }
});

/**
 * 作用：创建 PDF 导出菜单项（Electron 环境）
 * 意图：提供导出为 PDF 的功能
 * 调用时机：在 Electron 环境的 exportMd 函数中调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns PDF 导出菜单项配置对象
 */
export const createPDFExportMenuItem = (id: string): IMenu => ({
    id: "exportPDF",
    label: "PDF",
    icon: "iconPDF",
    /**
     * 作用：处理 PDF 导出点击事件
     * 意图：调用 Electron 的 PDF 导出功能
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        saveExport({ type: "pdf", id });
    }
});

/**
 * 作用：创建 HTML (SiYuan) 导出菜单项
 * 意图：提供导出为 SiYuan 风格 HTML 的功能
 * 调用时机：在 Electron 环境的 exportMd 函数中调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns HTML (SiYuan) 导出菜单项配置对象
 */
export const createHTMLSiYuanExportMenuItem = (id: string): IMenu => ({
    id: "exportHTML_SiYuan",
    label: "HTML (SiYuan)",
    iconClass: "ft__error",
    icon: "iconHTML5",
    /**
     * 作用：处理 HTML (SiYuan) 导出点击事件
     * 意图：调用 Electron 的 HTML 导出功能（SiYuan 风格）
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        saveExport({ type: "html", id });
    }
});

/**
 * 作用：创建 HTML (Markdown) 导出菜单项
 * 意图：提供导出为 Markdown 风格 HTML 的功能
 * 调用时机：在 Electron 环境的 exportMd 函数中调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns HTML (Markdown) 导出菜单项配置对象
 */
export const createHTMLMarkdownExportMenuItem = (id: string): IMenu => ({
    id: "exportHTML_Markdown",
    label: "HTML (Markdown)",
    icon: "iconHTML5",
    /**
     * 作用：处理 HTML (Markdown) 导出点击事件
     * 意图：调用 Electron 的 HTML 导出功能（Markdown 风格）
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        saveExport({ type: "htmlmd", id });
    }
});

/**
 * 作用：创建 Word .docx 导出菜单项
 * 意图：提供导出为 Word 文档的功能
 * 调用时机：在 Electron 环境的 exportMd 函数中调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns Word 导出菜单项配置对象
 */
export const createWordExportMenuItem = (id: string): IMenu => ({
    id: "exportWord",
    label: "Word .docx",
    icon: "iconDocx",
    /**
     * 作用：处理 Word 导出点击事件
     * 意图：调用 Electron 的 Word 导出功能
     * 调用时机：用户点击菜单项时
     */
    click: () => {
        saveExport({ type: "word", id });
    }
});
