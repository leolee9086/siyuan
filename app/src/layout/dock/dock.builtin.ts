/** 用途：集中维护内建 Dock 类型；使用范围：布局校验、按钮生成和初始化。 */
import {FILE_BROWSER_DOCK_TYPES} from "../../sforge/fileBrowser/FileBrowser.docks";

export const BUILTIN_DOCK_TYPES = [
    "file",
    "outline",
    "inbox",
    "bookmark",
    "tag",
    "graph",
    "globalGraph",
    "backlink",
    "forwardlink",
    "embedding_dock",
    "cronjob",
    "agentChat",
    "magi-identity-access",
    "sforge-colors",
    ...FILE_BROWSER_DOCK_TYPES,
] as const;

const BUILTIN_DOCK_TYPE_SET = new Set<string>(BUILTIN_DOCK_TYPES);

export function isBuiltinDockType(type: string) {
    return BUILTIN_DOCK_TYPE_SET.has(type);
}
