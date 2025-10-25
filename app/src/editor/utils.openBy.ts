import { fetchPost } from "../util/fetch";
import { useShell } from "../util/pathName";


export const openBy = (url: string, type: "folder" | "app") => {
    /// #if !BROWSER
    if (url.startsWith("assets/")) {
        fetchPost("/api/asset/resolveAssetPath", { path: url.replace(/\.pdf\?page=\d{1,}$/, ".pdf") }, (response) => {
            if (type === "app") {
                useShell("openPath", response.data);
            } else if (type === "folder") {
                useShell("showItemInFolder", response.data);
            }
        });
        return;
    }
    let address = "";
    if ("windows" === window.siyuan.config.system.os) {
        // `file://` 协议兼容 Window 平台使用 `/` 作为目录分割线 https://github.com/siyuan-note/siyuan/issues/5681
        address = url.replace("file:///", "").replace("file://\\", "").replace("file://", "").replace(/\//g, "\\");
    } else {
        address = url.replace("file://", "");
    }

    // 拖入文件名包含 `)` 、`(` 的文件以 `file://` 插入后链接解析错误 https://github.com/siyuan-note/siyuan/issues/5786
    address = address.replace(/\\\)/g, ")").replace(/\\\(/g, "(");
    if (type === "app") {
        useShell("openPath", address);
    } else if (type === "folder") {
        if ("windows" === window.siyuan.config.system.os) {
            if (!address.startsWith("\\\\")) { // \\ 开头的路径是 Windows 网络共享路径 https://github.com/siyuan-note/siyuan/issues/5980
                // Windows 端打开本地文件所在位置失效 https://github.com/siyuan-note/siyuan/issues/5808
                address = address.replace(/\\\\/g, "\\");
            }
        }
        useShell("showItemInFolder", address);
    }
    /// #endif
};
