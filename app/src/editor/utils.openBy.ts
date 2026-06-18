/** 用途：网络请求。使用范围：解析资源路径。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：调用系统 Shell 打开文件或文件夹。使用范围：在 Electron 环境中打开外部路径。解耦评估：通过 ./imports 转发。 */
import { useShell } from "./imports";
/** 用途：判断当前运行环境是否为 Electron。使用范围：仅在桌面端执行文件打开操作。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";
/** 用途：安全获取 SiYuan 全局配置。使用范围：读取系统 OS 类型。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";

/**
 * 根据类型调用 Shell 打开文件或文件夹
 */
function openByType(type: string, data: string) {
    // 文件类型直接打开，文件夹类型在资源管理器中显示
    if (type !== "folder") {
        useShell("openPath", data);
        return;
    }
    useShell("showItemInFolder", data);
}

/**
 * 转换 Windows 文件 URL 为本地路径
 */
function toWindowsPath(url: string) {
    return url
        .replace("file:///", "")
        .replace("file://\\", "")
        .replace("file://", "")
        .replace(/\//g, "\\");
}

/**
 * 使用系统默认方式打开文件或文件夹
 */
export const openBy = async (url: string, type: "folder" | "app") => {
    if (!isElectron) {
        return;
    }

    // assets 路径需要先由后端解析为真实文件系统路径
    if (url.startsWith("assets/")) {
        const assetPath = url.replace(/\.pdf\?page=\d{1,}$/, ".pdf");
        fetchPost("/api/asset/resolveAssetPath", { path: assetPath }, (response) => {
            openByType(type, response.data);
        });
        return;
    }

    const os = getSiyuanConfig().system.os;
    const pathAddress = os === "windows" ? toWindowsPath(url) : url.replace("file://", "");
    const cleanedAddress = pathAddress
        .replace(/\\\)/g, ")")
        .replace(/\\\(/g, "(");

    // 非文件夹类型直接用系统默认程序打开
    if (type !== "folder") {
        useShell("openPath", cleanedAddress);
        return;
    }
    // 打开所在文件夹（定位到文件）
    useShell("showItemInFolder", cleanedAddress);
};

