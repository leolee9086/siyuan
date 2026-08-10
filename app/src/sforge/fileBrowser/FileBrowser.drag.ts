/**
 * 用途：文件树与画廊共用拖放数据边界。
 * 使用范围：移动和标签投递入口。
 * 解耦评估：拖放解析必须共享同一 JSON 记录判定；以参数传递替代会让多个入口重复实现边界。
 */
import {isRecord} from "./FileBrowser.guards";
/**
 * 用途：拖放项结构守卫。
 * 使用范围：多选载荷和单项载荷解析。
 * 解耦评估：该纯守卫属于拖放领域契约，调用方注入会重复校验逻辑，保持模块复用。
 */
import {isFileBrowserDragItem} from "./FileBrowser.drag.guards";
/** 用途：拖放载荷领域类型；使用范围：树和画廊之间的受控传递。 */
import type {FileBrowserDragData} from "./FileBrowser.types";

/** 文件树/画廊使用的受控 MIME，避免与普通文本拖放混淆。 */
export const FILE_BROWSER_DRAG_MIME = "application/x-sforge-file";

/** 规范化载荷中的根内路径，阻止绝对路径和父级段进入领域层。 */
function normalizeRelativePath(value: string) {
    const normalized = value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!normalized || normalized.split("/").some(part => !part || part === "." || part === "..")) {
        return undefined;
    }
    return normalized;
}

/** 将未信任的 JSON 项规范化为根内拖放项，供单项和多选载荷共用。 */
function parseFileBrowserDragItem(value: unknown) {
    if (!isRecord(value) || typeof value.rootID !== "string" || typeof value.path !== "string" ||
        (value.kind !== "file" && value.kind !== "directory")) {
        return undefined;
    }
    const path = normalizeRelativePath(value.path);
    if (!value.rootID.trim() || !path) {
        return undefined;
    }
    const pathName = path.split("/").at(-1) ?? "";
    const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : pathName;
    if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        return undefined;
    }
    return {rootID: value.rootID.trim(), path, kind: value.kind, name};
}

/**
 * 只接受本地文件浏览器产生的根内相对地址，不信任拖放文本的绝对路径。
 * @同步豁免: 性能考虑 - drop 事件必须在当前事件处理器内完成边界解析。
 * @显式返回类型原因: 解析失败必须稳定返回 undefined，供 Panel 和标签树共享同一边界。
 */
export function parseFileBrowserDragData(raw: string | undefined): FileBrowserDragData | undefined {
    if (!raw) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return undefined;
        }
        const rawItems = parsed.items;
        const items = rawItems === undefined
            ? undefined
            : Array.isArray(rawItems) && rawItems.length > 0
                ? rawItems.map(parseFileBrowserDragItem)
                : undefined;
        if (rawItems !== undefined && (!items || items.some(item => !item))) {
            return undefined;
        }
        const parsedItems = items?.filter(isFileBrowserDragItem) ?? [];
        const first = parsedItems[0] ?? parseFileBrowserDragItem(parsed);
        if (!first) {
            return undefined;
        }
        const unique = new Set(parsedItems.map(item => `${item.rootID.toLowerCase()}\x00${item.path}`));
        if (parsedItems.length > 0 && unique.size !== parsedItems.length) {
            return undefined;
        }
        return parsedItems.length > 1 ? {...first, items: parsedItems} : first;
    } catch {
        return undefined;
    }
}
