/**
 * Diff 粒度。
 *
 * v1 默认使用 line；word 预留给后续字级/词级高亮。
 */
export type DiffGranularity = "line" | "word";

/**
 * Diff 视图模式。
 *
 * v1 先实现 inline，split 为后续扩展能力。
 */
export type DiffViewMode = "inline" | "split";

/**
 * 行内差异片段（扩展字段）。
 *
 * 仅在 word 粒度或未来增强模式下使用。
 */
export interface DiffInlineSegment {
    readonly kind: "context" | "added" | "removed";
    readonly text: string;
}

/**
 * 单行差异。
 */
export interface DiffLine {
    readonly kind: "context" | "added" | "removed";
    readonly oldLineNumber: number | null;
    readonly newLineNumber: number | null;
    readonly text: string;
    readonly inlineSegments?: readonly DiffInlineSegment[];
}

/**
 * 差异分块（hunk）。
 */
export interface DiffHunk {
    readonly oldStart: number;
    readonly oldLength: number;
    readonly newStart: number;
    readonly newLength: number;
    readonly lines: readonly DiffLine[];
}

/**
 * 差异摘要。
 */
export interface DiffSummary {
    readonly addedLines: number;
    readonly removedLines: number;
    readonly contextLines: number;
}

/**
 * 通用差异模型。
 *
 * 任何算法库输出都需要先转换到该模型，再交给渲染层。
 */
export interface DiffModel {
    readonly oldText: string;
    readonly newText: string;
    readonly hunks: readonly DiffHunk[];
    readonly summary: DiffSummary;
    readonly granularity: DiffGranularity;
}

/**
 * 差异构建请求。
 */
export interface DiffBuildRequest {
    readonly oldText: string;
    readonly newText: string;
    readonly fileName?: string;
    readonly contextLines?: number;
    readonly granularity?: DiffGranularity;
}

/**
 * 能力描述，用于算法层与渲染层的能力协商。
 */
export interface DiffCapabilities {
    readonly supportsSplitView: boolean;
    readonly supportsInlineSegments: boolean;
}

/**
 * 算法层接口。
 */
export interface DiffEngine {
    readonly id: string;
    readonly capabilities: DiffCapabilities;
    build(request: DiffBuildRequest): DiffModel;
}

/**
 * 渲染层适配接口（保留对接能力）。
 *
 * v1 自研渲染可直接实现该接口，后续第三方渲染器也可接入。
 */
export interface DiffRendererAdapter {
    readonly id: string;
    readonly capabilities: DiffCapabilities;
    readonly supportedModes: readonly DiffViewMode[];
}

