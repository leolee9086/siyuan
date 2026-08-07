/** 用途：面包屑领域类型；使用范围：根内路径导航。 */
import type {FileBrowserBreadcrumb} from "./FileBrowser.types";

/** 将 Kernel 返回的斜杠路径拆成无空段的相对路径。 */
export function splitFileBrowserPath(path: string) {
    return path.replaceAll("\\", "/").split("/").filter(Boolean);
}

/** 返回当前路径的父目录；根目录保持为空字符串。 */
export function parentFileBrowserPath(path: string) {
    const parts = splitFileBrowserPath(path);
    parts.pop();
    return parts.join("/");
}

/** 从根标签和相对路径生成可直接提交给 Kernel 的面包屑。 */
export function buildFileBrowserBreadcrumbs(rootLabel: string, path: string): FileBrowserBreadcrumb[] {
    const breadcrumbs: FileBrowserBreadcrumb[] = [{label: rootLabel || "工作空间", path: ""}];
    const parts = splitFileBrowserPath(path);
    for (let index = 0; index < parts.length; index++) {
        const label = parts[index];
        if (!label) {
            continue;
        }
        breadcrumbs.push({
            label,
            path: parts.slice(0, index + 1).join("/"),
        });
    }
    return breadcrumbs;
}
