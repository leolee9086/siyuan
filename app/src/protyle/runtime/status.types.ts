/**
 * 状态栏目标元素。
 *
 * Protyle 只把宿主明确传入的元素作为统计输出目标，不假设宿主存在固定的
 * `#status` 或 `.status__counter` 结构。
 */
export type StatusElementTarget = HTMLElement | string;

/** Protyle 字数统计能力返回的统计结果。 */
export interface IProtyleStatusStat {
    runeCount: number;
    wordCount: number;
    linkCount: number;
    imageCount: number;
    refCount: number;
    blockCount: number;
}

/**
 * Protyle 使用的最小状态统计宿主能力。
 *
 * 该接口不包含状态栏按钮、Dock 菜单、Electron IPC 或主应用布局操作；这些
 * 行为仍由完整 App 适配器自行保留。
 */
export interface IProtyleStatusPort {
    countSelection: (range: Range, rootId?: string, status?: StatusElementTarget) => void;
    countBlocks: (ids: string[], rootId?: string, clearCache?: boolean, status?: StatusElementTarget) => void;
    clear: (status?: StatusElementTarget) => void;
}
