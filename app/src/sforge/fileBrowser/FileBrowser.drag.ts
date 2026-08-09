/** 用途：文件树与画廊共用拖放数据边界；使用范围：移动和标签投递入口。 */
import type {FileBrowserDragData} from "./FileBrowser.types";
import {isRecord} from "./FileBrowser.guards";

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

/** @同步豁免: 性能考虑；drop 事件必须在当前事件处理器内完成边界解析。 */
/** @显式返回类型原因: 解析失败必须稳定返回 undefined，供 Panel 和标签树共享同一边界。 */
/** 只接受本地文件浏览器产生的根内相对地址，不信任拖放文本的绝对路径。 */
export function parseFileBrowserDragData(raw: string | undefined): FileBrowserDragData | undefined {
    if (!raw) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return undefined;
        }
        if (typeof parsed.rootID !== "string" || typeof parsed.path !== "string" ||
            (parsed.kind !== "file" && parsed.kind !== "directory")) {
            return undefined;
        }
        const path = normalizeRelativePath(parsed.path);
        if (!parsed.rootID.trim() || !path) {
            return undefined;
        }
        const pathName = path.split("/").at(-1) ?? "";
        const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : pathName;
        if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
            return undefined;
        }
        return {rootID: parsed.rootID.trim(), path, kind: parsed.kind, name};
    } catch {
        return undefined;
    }
}
