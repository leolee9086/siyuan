
/**
 * MAGI 入口构建目标
 *
 * 用途：约束桌面/electron/移动三类入口标识。
 * 使用场景：初始化 `window.siyuan.magi.target` 与路径解析。
 * 关联类型：`bootstrapMagiSiyuan`、`resolveMagiDesktopTargetFromPathname` 入参/返回值。
 */
export type MagiBuildTarget = "magi-app" | "magi-desktop" | "magi-mobile" | "magi-identity";
