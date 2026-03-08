/**
 * MAGI 入口运行时对象类型
 *
 * 用途：描述 MAGI 独立入口对 `window.siyuan` 的最小依赖结构。
 * 使用场景：`magiEntry.environment.ts` 初始化运行时上下文时使用。
 * 关联类型：由入口脚本 `index.ts`、`mobile.ts` 通过环境函数间接使用。
 */
export interface MagiSiyuanRuntime {
    config?: { appearance?: { lang?: string } };
    languages?: Record<string, unknown>;
    magi?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * MAGI 入口构建目标
 *
 * 用途：约束桌面/electron/移动三类入口标识。
 * 使用场景：初始化 `window.siyuan.magi.target` 与路径解析。
 * 关联类型：`bootstrapMagiSiyuan`、`resolveMagiDesktopTargetFromPathname` 入参/返回值。
 */
export type MagiBuildTarget = "magi-app" | "magi-desktop" | "magi-mobile";
