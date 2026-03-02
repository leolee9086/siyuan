import { structuredPatch, type StructuredPatch, type StructuredPatchHunk } from "diff";
import type { DiffBuildRequest, DiffEngine, DiffHunk, DiffLine, DiffModel, DiffSummary } from "./diff.types";

const DEFAULT_CONTEXT_LINES = 3;

/**
 * 作用：将单个 hunk 的原始行数据转换为统一 DiffLine 列表。
 * 意图：把算法库输出标准化，隔离业务层对第三方结构的依赖。
 * 调用时机：构建 DiffModel 时逐个 hunk 调用。
 * 问题/改进：当前仅支持行级，后续可扩展 inlineSegments。
 */
function convertHunkToLines(
    hunk: StructuredPatchHunk,
    summaryCounter: { added: number; removed: number; context: number },
): readonly DiffLine[] {
    let oldCursor = hunk.oldStart;
    let newCursor = hunk.newStart;
    const lines: DiffLine[] = [];

    for (const rawLine of hunk.lines) {
        // patch 元信息行（例如 no newline 标记）不参与差异渲染。
        if (rawLine.startsWith("\\")) {
            continue;
        }
        const marker = rawLine.charAt(0);
        const text = rawLine.slice(1);

        // '+' 表示新增行，仅递增新文本行号游标。
        if (marker === "+") {
            lines.push({
                kind: "added",
                oldLineNumber: null,
                newLineNumber: newCursor,
                text,
            });
            summaryCounter.added += 1;
            newCursor += 1;
            continue;
        }
        // '-' 表示删除行，仅递增旧文本行号游标。
        if (marker === "-") {
            lines.push({
                kind: "removed",
                oldLineNumber: oldCursor,
                newLineNumber: null,
                text,
            });
            summaryCounter.removed += 1;
            oldCursor += 1;
            continue;
        }

        // 其余情况视为上下文行，同时递增新旧行号游标。
        lines.push({
            kind: "context",
            oldLineNumber: oldCursor,
            newLineNumber: newCursor,
            text: marker === " " ? text : rawLine,
        });
        summaryCounter.context += 1;
        oldCursor += 1;
        newCursor += 1;
    }

    return lines;
}

/**
 * 作用：构建行级 DiffModel。
 * 意图：作为算法层稳定出口，供任意渲染器消费。
 * 调用时机：DiffEngine.build 调用时执行。
 * 问题/改进：词级差异需要单独引擎实现并挂到同一接口。
 */
function buildLineDiffModel(request: DiffBuildRequest): DiffModel {
    const patch: StructuredPatch = structuredPatch(
        request.fileName ?? "before",
        request.fileName ?? "after",
        request.oldText,
        request.newText,
        "",
        "",
        {
            context: request.contextLines ?? DEFAULT_CONTEXT_LINES,
        },
    );

    const summaryCounter = { added: 0, removed: 0, context: 0 };
    const hunks: DiffHunk[] = [];
    for (const hunk of patch.hunks) {
        hunks.push({
            oldStart: hunk.oldStart,
            oldLength: hunk.oldLines,
            newStart: hunk.newStart,
            newLength: hunk.newLines,
            lines: convertHunkToLines(hunk, summaryCounter),
        });
    }

    const summary: DiffSummary = {
        addedLines: summaryCounter.added,
        removedLines: summaryCounter.removed,
        contextLines: summaryCounter.context,
    };

    return {
        oldText: request.oldText,
        newText: request.newText,
        hunks,
        summary,
        // v1 固定行级，word 粒度作为扩展能力保留。
        granularity: "line",
    };
}

/** @同步豁免: UI构建 — 仅创建同步引擎实例，供 computed 与渲染路径直接调用 */
/**
 * 作用：创建默认行级 diff 引擎实例。
 * 意图：向上层暴露稳定算法接口，避免直接依赖第三方包。
 * 调用时机：业务模块初始化 diff 能力时调用。
 * 问题/改进：后续可增加参数化配置（如空白字符忽略策略）。
 */
export function createLineDiffEngine(): DiffEngine {
    return {
        id: "js-diff-line-engine",
        capabilities: {
            supportsSplitView: true,
            supportsInlineSegments: false,
        },
        build: buildLineDiffModel,
    };
}

