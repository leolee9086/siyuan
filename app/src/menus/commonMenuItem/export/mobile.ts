/**
 * 用途：移动端导出菜单项创建
 * 使用范围：exportMd 函数中非 Electron 环境的导出选项
 * 解耦评估：独立文件，专门处理移动端导出逻辑
 */
/**
 * 用途：全局常量定义
 * 使用范围：获取导出配置键
 * 解耦评估：通过 imports.ts 统一管理
 */
import { Constants } from "../imports";
/**
 * 用途：发送异步 POST 请求
 * 使用范围：导出预览 HTML
 * 解耦评估：通过 imports.ts 统一管理
 */
import { fetchPost } from "../imports";
/**
 * 用途：隐藏消息提示
 * 使用范围：导出完成后隐藏进度提示
 * 解耦评估：通过 imports.ts 统一管理
 */
import { hideMessage } from "../imports";
/**
 * 用途：检测 Android 环境
 * 使用范围：判断是否调用 Android 打印接口
 * 解耦评估：通过 imports.ts 统一管理
 */
import { isInAndroid } from "../imports";
/**
 * 用途：检测 Harmony 环境
 * 使用范围：判断是否调用 Harmony 打印接口
 * 解耦评估：通过 imports.ts 统一管理
 */
import { isInHarmony } from "../imports";
/**
 * 用途：检测 iOS 环境
 * 使用范围：判断是否调用 iOS 打印接口
 * 解耦评估：通过 imports.ts 统一管理
 */
import { isInIOS } from "../imports";
/**
 * 用途：检测移动应用环境
 * 使用范围：判断是否显示打印选项
 * 解耦评估：通过 imports.ts 统一管理
 */
import { isInMobileApp } from "../imports";
/**
 * 用途：处理导出内容转换
 * 使用范围：将预览 HTML 转换为导出格式
 * 解耦评估：通过 imports.ts 统一管理
 */
import { onExport } from "../imports";
/**
 * 用途：保存导出文件
 * 使用范围：HTML 导出功能
 * 解耦评估：通过 imports.ts 统一管理
 */
import { saveExport } from "../imports";
/**
 * 用途：显示消息提示
 * 使用范围：显示导出进度
 * 解耦评估：通过 imports.ts 统一管理
 */
import { showMessage } from "../imports";
/**
 * 用途：国际化文本
 * 使用范围：菜单项标签
 * 解耦评估：通过 imports.ts 统一管理
 */
import { siyuanI18n } from "../imports";
/**
 * 用途：获取思源本地存储
 * 使用范围：读取导出配置
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getSiyuanStorage } from "../imports";
/**
 * 用途：获取 location.protocol
 * 使用范围：构建服务路径
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getLocationProtocol } from "../imports";
/**
 * 用途：获取 location.host
 * 使用范围：构建服务路径
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getLocationHost } from "../imports";
/**
 * 用途：获取 Android 原生接口
 * 使用范围：调用 Android 打印功能
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getWindowJSAndroid } from "../imports";
/**
 * 用途：获取 Harmony 原生接口
 * 使用范围：调用 Harmony 打印功能
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getWindowJSHarmony } from "../imports";
/**
 * 用途：获取 iOS 原生接口
 * 使用范围：调用 iOS 打印功能
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getWindowWebkit } from "../imports";

/**
 * 用途：处理移动端 PDF 导出的回调
 * 意图：将导出的 HTML 发送到对应平台的打印接口
 * 调用时机：fetchPost 获取到预览 HTML 后
 */
const handleMobilePDFExport = async (response: IWebSocketData, id: string, msgId: string | undefined) => {
    const servePath = getLocationProtocol() + "//" + getLocationHost() + "/";
    const html = await onExport(response, "", servePath, { type: "pdf", id }) || "";
    const fileName = response.data.name || "export";
    
    // 判断是否为 Android 平台，调用 Android 打印接口
    if (isInAndroid()) {
        getWindowJSAndroid().print(fileName, html);
        return;
    }
    
    // 判断是否为 Harmony 平台，调用 Harmony 打印接口
    if (isInHarmony()) {
        getWindowJSHarmony().print(fileName, html);
        return;
    }
    
    // 判断是否为 iOS 平台，调用 iOS 打印接口
    if (isInIOS()) {
        getWindowWebkit().messageHandlers.print.postMessage(fileName + Constants.ZWSP + html);
        return;
    }

    // 延迟 3 秒隐藏导出进度消息，确保用户看到导出完成提示
    setTimeout(() => {
        // 检查 msgId 是否存在再隐藏消息
        if (msgId) {
            hideMessage(msgId);
        }
    }, 3000);
};

/**
 * 用途：创建移动端 PDF 打印菜单项
 * 意图：在移动应用中提供 PDF 打印功能
 * 调用时机：exportMd 函数构建非 Electron 环境菜单时
 * @同步豁免: UI构建 - 菜单项配置对象的创建是同步的
 */
export const createMobilePDFMenuItem = (id: string) => {
    return {
        id: "exportPDF",
        label: siyuanI18n.print,
        icon: "iconPDF",
        ignore: !isInMobileApp(),
        /**
         * 用途：触发移动端 PDF 导出
         * 意图：显示进度提示并调用后端导出接口
         * 调用时机：用户点击打印菜单项时
         */
        click: () => {
            const msgId = showMessage(siyuanI18n.exporting);
            const storage = getSiyuanStorage();
            const localData = storage[Constants.LOCAL_EXPORTPDF];
            fetchPost("/api/export/exportPreviewHTML", {
                id,
                keepFold: localData.keepFold,
                merge: localData.mergeSubdocs,
            }, (response) => handleMobilePDFExport(response, id, msgId));
        }
    };
};

/**
 * 用途：创建移动端 HTML (SiYuan) 导出菜单项
 * 意图：在移动端提供 SiYuan 格式的 HTML 导出
 * 调用时机：exportMd 函数构建非 Electron 环境菜单时
 * @同步豁免: UI构建 - 菜单项配置对象的创建是同步的
 */
export const createMobileHTMLSiYuanMenuItem = (id: string) => {
    return {
        id: "exportHTML_SiYuan",
        label: "HTML (SiYuan)",
        iconClass: "ft__error",
        icon: "iconHTML5",
        /**
         * 用途：触发 SiYuan 格式 HTML 导出
         * 意图：调用导出接口保存文件
         * 调用时机：用户点击菜单项时
         */
        click: () => {
            saveExport({ type: "html", id });
        }
    };
};

/**
 * 用途：创建移动端 HTML (Markdown) 导出菜单项
 * 意图：在移动端提供 Markdown 格式的 HTML 导出
 * 调用时机：exportMd 函数构建非 Electron 环境菜单时
 * @同步豁免: UI构建 - 菜单项配置对象的创建是同步的
 */
export const createMobileHTMLMarkdownMenuItem = (id: string) => {
    return {
        id: "exportHTML_Markdown",
        label: "HTML (Markdown)",
        icon: "iconHTML5",
        /**
         * 用途：触发 Markdown 格式 HTML 导出
         * 意图：调用导出接口保存文件
         * 调用时机：用户点击菜单项时
         */
        click: () => {
            saveExport({ type: "htmlmd", id });
        }
    };
};
