/** 用途：标准路径实现；使用范围：路径分段、扩展名和基础名称；解耦评估：经同域网关隔离平台实现。 */
import {getOriginalPath, path} from "./imports";

/** 返回构建环境可用的 POSIX 路径实现。 @同步豁免: 遗留代码 */
export const pathPosix = () => path.posix;

/** Electron 返回原生路径实现，浏览器保留 POSIX 兼容实现。 @同步豁免: 遗留代码 */
export const originalPath = () => getOriginalPath();

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

/** 返回不含查询串和片段的资产路径。 @同步豁免: 路径计算 */
const getAssetPathWithoutQuery = (assetPath: string) => assetPath.split(/[?#]/, 1)[0];

/** 返回资源扩展名并忽略查询串和片段。 @同步豁免: 路径计算 */
export const getAssetExtension = (assetPath: string) => pathPosix().extname(getAssetPathWithoutQuery(assetPath));

/** 从资源路径中移除扩展名和 SiYuan 时间戳后缀。 @同步豁免: UI构建 */
export const getAssetName = (assetPath: string) => {
    const pathWithoutQuery = getAssetPathWithoutQuery(assetPath);
    return pathPosix().basename(pathWithoutQuery, getAssetExtension(pathWithoutQuery)).replace(/-\d{14}-\w{7}/, "");
};
