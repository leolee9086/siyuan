/** 用途：标准路径实现；使用范围：路径分段、扩展名和基础名称；解耦评估：经同域网关隔离平台实现。 */
import {path} from "./imports";

/** 返回构建环境可用的 POSIX 路径实现。 @同步豁免: 遗留代码 */
export const pathPosix = () => {
    if (path.posix) {
        return path.posix;
    }
    return path;
};

/** 返回未经 POSIX 适配的原始路径实现。 @同步豁免: 遗留代码 */
export const originalPath = () => path;

/** 取得文件或文档的显示名称。 @同步豁免: UI构建 */
export const getDisplayName = (filePath: string, basename = true, removeSY = false) => {
    let name = filePath;
    if (basename) {
        name = pathPosix().basename(filePath);
    }
    // 文档树传入 `.sy` 文件名时，显示文本沿用原规则移除内部存储扩展名。
    if (removeSY && name.endsWith(".sy")) {
        name = name.slice(0, -3);
    }
    return name;
};

/** 取得文档显示名称，并保留既有空标题和 HTML 转义语义。 @同步豁免: UI构建 */
export const getDocDisplayName = (name: string, titleEmpty?: boolean, escape?: boolean) => {
    if (titleEmpty) {
        const kernelLanguages = window.siyuan.languages["_kernel"];
        return kernelLanguages[16];
    }
    const displayName = getDisplayName(name, true, true);
    if (escape) {
        return Lute.EscapeHTMLStr(displayName);
    }
    return displayName;
};

/** 从资源路径中移除扩展名和 SiYuan 时间戳后缀。 @同步豁免: UI构建 */
export const getAssetName = (assetPath: string) => {
    return pathPosix().basename(assetPath, pathPosix().extname(assetPath)).replace(/-\d{14}-\w{7}/, "");
};
