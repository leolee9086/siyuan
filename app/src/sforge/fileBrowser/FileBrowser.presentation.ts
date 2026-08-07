/** 用途：文件和根领域类型；使用范围：紧凑列表文案。 */
import type {FileBrowserEntry, FileBrowserPermission, FileBrowserRoot} from "./FileBrowser.types";

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 把字节数格式化为适合窄 Dock 的短文本。 */
export function formatFileBrowserSize(size: number, isDirectory = false) {
    if (isDirectory) {
        return "文件夹";
    }
    const normalized = Number.isFinite(size) && size > 0 ? size : 0;
    if (normalized < 1024) {
        return `${normalized} B`;
    }
    const unitIndex = Math.min(Math.floor(Math.log(normalized) / Math.log(1024)), SIZE_UNITS.length - 1);
    const value = normalized / Math.pow(1024, unitIndex);
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${SIZE_UNITS[unitIndex]}`;
}

/** 把 Unix 秒转成当前设备的紧凑日期时间。 */
export function formatFileBrowserUpdated(updated: number) {
    if (!Number.isFinite(updated) || updated <= 0) {
        return "";
    }
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(updated * 1000));
}

/** 给根权限提供稳定、可本地理解的短标签。 */
export function formatFileBrowserPermission(permission: FileBrowserPermission) {
    if (permission === "read-write") {
        return "可读写";
    }
    if (permission === "command") {
        return "可执行";
    }
    return "只读";
}

/** 汇总同一真实目录的 Agent 会话来源数量。 */
export function formatFileBrowserSources(root: FileBrowserRoot) {
    const count = root.sources?.length ?? 0;
    if (root.kind === "workspace") {
        return "工作空间";
    }
    return `${count} 个绑定来源`;
}

/** 生成目录项的第二行信息。 */
export function describeFileBrowserEntry(entry: FileBrowserEntry) {
    const kind = entry.restricted ? "受限链接" : formatFileBrowserSize(entry.size, entry.isDir);
    const updated = formatFileBrowserUpdated(entry.updated);
    return updated ? `${kind} · ${updated}` : kind;
}
