/** 用途：提供导出 IPC 命令；使用范围：桌面资源导出；解耦评估：经本域网关直达稳定常量。 */
import {Constants} from "./imports";
/** 用途：提交资源复制请求；使用范围：导出与文件剪贴板；解耦评估：经本域网关直达网络原语。 */
import {fetchPost} from "./imports";
/** 用途：生成默认导出名；使用范围：桌面保存对话框；解耦评估：经本域网关复用路径唯一规则。 */
import {getAssetName} from "./imports";
/** 用途：读取系统平台配置；使用范围：文件剪贴板可用性判断；解耦评估：经本域网关使用显式失败的配置访问器。 */
import {getSiyuanConfig} from "./imports";
/** 用途：调用桌面保存对话框；使用范围：Electron 导出；解耦评估：经本域网关直达 IPC 适配器。 */
import {ipcInvoke} from "./imports";
/** 用途：选择 Web 或 Electron 导出；使用范围：资源导出命令；解耦评估：经本域网关读取运行平台事实。 */
import {isElectron} from "./imports";
/** 用途：选择 Android 原生剪贴板；使用范围：PNG 图片复制；解耦评估：经本域网关复用平台兼容判断。 */
import {isInAndroid} from "./imports";
/** 用途：解析资源扩展名；使用范围：默认导出文件名；解耦评估：经本域网关复用 POSIX 路径实现。 */
import {pathPosix} from "./imports";
/** 用途：执行浏览器资源下载；使用范围：Web 导出；解耦评估：经本域网关复用既有平台适配器。 */
import {saveExportFile} from "./imports";
/** 用途：展示资源动作结果；使用范围：导出、文件复制与权限错误；解耦评估：经本域网关保持全局消息语义。 */
import {showMessage} from "./imports";
/** 用途：提供资源动作本地化文案；使用范围：菜单和结果消息；解耦评估：经本域网关读取运行时语言。 */
import {siyuanI18n} from "./imports";
/** 用途：约束桌面保存对话框响应；使用范围：Electron 导出分支；解耦评估：官方 Electron 数据契约只参与类型检查。 */
import type {SaveDialogReturnValue} from "./imports";
/** 用途：同步创建浏览器 PNG 剪贴板条目；使用范围：Clipboard API 写入边界；解耦评估：对象构造集中在 factory 文件，未保存状态。 */
import {createPNGClipboardItem} from "./clipboardItem.factory";

/** 作用：处理桌面文件复制响应；意图：集中成功提示；调用时机：保存位置确认后；改进：服务端失败仍沿用既有静默语义。 */
const handleAssetExportResponse = (response: IWebSocketData) => {
    // 仅服务端完成文件复制时通知用户，失败响应维持历史行为。
    if (response.code !== 0) {
        return;
    }
    showMessage(siyuanI18n.exported);
};

/** 作用：处理系统文件剪贴板响应；意图：保留成功和失败的不同反馈；调用时机：用户执行文件复制后；改进：关闭时长继续由服务端响应决定。 */
const handleAssetClipboardResponse = (response: IWebSocketData) => {
    // 后端确认写入成功后才展示复制完成，失败分支保留接口消息和超时。
    if (response.code === 0) {
        showMessage(siyuanI18n.copied);
        return;
    }
    showMessage(response.msg || "", response.data?.closeTimeout ?? 5000, "error");
};

/** 作用：获取 Canvas 2D 绘制上下文；意图：在图像转码不可用时显式失败；调用时机：Blob 或跨域图片转 PNG；改进：不静默跳过剪贴板写入。 */
const getCanvas2DContext = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("PNG clipboard conversion requires a 2D canvas context");
    }
    return context;
};

/** 创建资源导出菜单配置，并按当前平台执行 Web 下载或桌面文件复制。 */
/** @同步豁免: UI构建 - 菜单组装要求立即返回 IMenu 配置；实际文件导出仍在 click 异步命令内执行。 */
export const exportAsset = (src: string) => ({
    id: "export",
    label: siyuanI18n.export,
    icon: "iconUpload",
    /** 作用：按运行平台完成导出；意图：保持菜单命令只声明资源路径；调用时机：用户点击资源导出项；改进：桌面复制失败仍沿用后端消息协议。 */
    async click() {
        if (!isElectron) {
            saveExportFile(src);
            return;
        }
        const result = await ipcInvoke<SaveDialogReturnValue>(Constants.SIYUAN_GET, {
            cmd: "showSaveDialog",
            defaultPath: getAssetName(src) + pathPosix().extname(src),
            properties: ["showOverwriteConfirmation"],
        });
        // 用户取消保存对话框时不得发起后端复制请求。
        if (result.canceled) {
            return;
        }
        fetchPost("/api/file/copyFile", {src, dest: result.filePath}, handleAssetExportResponse);
    },
});

/** 创建“复制资源文件”菜单配置；仅 Windows 与 macOS 桌面系统支持。 */
/** @同步豁免: UI构建 - 菜单构建阶段必须同步返回可见配置或 ignore 标记，改为 Promise 会破坏现有 MenuItem 构造协议。 */
export const writeAssetToClipboard = (src: string) => {
    if (["windows", "darwin"].includes(getSiyuanConfig().system.os)) {
        return {
            id: "copyFile",
            label: siyuanI18n.copyFile,
            icon: "iconFile",
            /** 作用：提交当前资源路径给系统剪贴板；意图：使文件管理器可粘贴真实文件；调用时机：用户点击文件复制项；改进：非支持系统在配置阶段隐藏。 */
            click: () => fetchPost("/api/clipboard/writeFilePath", {path: src}, handleAssetClipboardResponse),
        };
    }
    return {ignore: true};
};

/** 作用：将 PNG Blob 写入浏览器剪贴板；意图：集中处理权限失败；调用时机：原图或转码图已准备好时；改进：非安全上下文仍使用既有提示。 */
const writePNGBlob = (blob: Blob) => {
    try {
        navigator.clipboard.write([
            createPNGClipboardItem(blob),
        ]).catch(() => {
            showMessage(siyuanI18n.clipboardPermissionDenied);
        });
    } catch {
        showMessage(siyuanI18n.clipboardPermissionDenied);
    }
};

/** 作用：将任意图片 Blob 规范化为 PNG；意图：避免把非 PNG 原始格式交给剪贴板；调用时机：链接请求成功后；改进：图像解码失败只清理对象 URL。 */
const blobToPNGClipboard = (blob: Blob) => {
    // PNG 已满足剪贴板格式要求，无需 canvas 重编码。
    if (blob.type === "image/png") {
        writePNGBlob(blob);
        return;
    }
    const objectURL = URL.createObjectURL(blob);
    const canvas = document.createElement("canvas");
    const tempElement = document.createElement("img");
    tempElement.onload = () => {
        canvas.width = tempElement.naturalWidth;
        canvas.height = tempElement.naturalHeight;
        getCanvas2DContext(canvas).drawImage(tempElement, 0, 0);
        URL.revokeObjectURL(objectURL);
        canvas.toBlob((pngBlob) => {
            if (pngBlob) {
                writePNGBlob(pngBlob);
            }
        }, "image/png", 1);
    };
    tempElement.onerror = () => {
        URL.revokeObjectURL(objectURL);
    };
    tempElement.src = objectURL;
};

/** 作用：以 CORS 图像加载路径重试复制；意图：保留请求 Blob 失败时的既有降级流程；调用时机：fetch 或响应状态失败后；改进：目标服务仍需允许跨域读取。 */
const loadCrossOriginImageToClipboard = (link: string) => {
    const canvas = document.createElement("canvas");
    const tempElement = document.createElement("img");
    tempElement.crossOrigin = "anonymous";
    tempElement.onload = () => {
        canvas.width = tempElement.naturalWidth;
        canvas.height = tempElement.naturalHeight;
        getCanvas2DContext(canvas).drawImage(tempElement, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) {
                writePNGBlob(blob);
            }
        }, "image/png", 1);
    };
    tempElement.src = link;
};

/** 将图片链接内容转换为 PNG 后写入当前平台剪贴板。 */
/** @同步豁免: 遗留代码 - Android 原生桥要求在当前用户手势中立即调用；浏览器分支保持原有 fire-and-forget 返回契约。 */
export const copyPNGByLink = (link: string) => {
    // Android 提供原生剪贴板桥，不能走浏览器 Clipboard API。
    if (isInAndroid()) {
        window.JSAndroid.writeImageClipboard(link);
        return;
    }
    fetch(link).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        blobToPNGClipboard(await response.blob());
    }).catch(() => loadCrossOriginImageToClipboard(link));
};
