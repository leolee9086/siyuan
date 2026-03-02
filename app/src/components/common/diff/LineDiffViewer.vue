<template>
  <div class="line-diff-viewer">
    <header class="line-diff-viewer-header">
      <strong>{{ title }}</strong>
      <span class="line-diff-viewer-summary">
        +{{ model.summary.addedLines }} / -{{ model.summary.removedLines }}
      </span>
    </header>
    <div v-if="model.hunks.length === 0" class="line-diff-viewer-empty">
      {{ emptyText }}
    </div>
    <div v-else class="line-diff-viewer-body">
      <section
        v-for="(hunk, index) in model.hunks"
        :key="`hunk_${index}_${hunk.oldStart}_${hunk.newStart}`"
        class="line-diff-hunk"
      >
        <div class="line-diff-hunk-header">
          @@ -{{ hunk.oldStart }},{{ hunk.oldLength }} +{{ hunk.newStart }},{{ hunk.newLength }} @@
        </div>
        <div
          v-for="(line, lineIndex) in hunk.lines"
          :key="`line_${index}_${lineIndex}`"
          class="line-diff-row"
          :class="`is-${line.kind}`"
        >
          <span class="line-diff-no old">{{ formatLineNumber(line.oldLineNumber) }}</span>
          <span class="line-diff-no new">{{ formatLineNumber(line.newLineNumber) }}</span>
          <span class="line-diff-marker">{{ markerByKind(line.kind) }}</span>
          <pre class="line-diff-text">{{ line.text || " " }}</pre>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiffLine, DiffModel } from "../../../util/diff/diff.types";
import "./LineDiffViewer.css";

withDefaults(defineProps<{
  model: DiffModel;
  title?: string;
  emptyText?: string;
}>(), {
  title: "差异预览",
  emptyText: "无差异",
});

/**
 * 作用：格式化行号显示文本。
 * 意图：统一处理空行号（新增/删除侧）显示为空字符串。
 * 调用时机：模板渲染每一行时调用。
 * 问题/改进：后续可扩展为固定宽度补零格式。
 */
function formatLineNumber(lineNumber: number | null): string {
  if (lineNumber === null) {
    return "";
  }
  return String(lineNumber);
}

/**
 * 作用：根据行类型返回差异符号。
 * 意图：让渲染层与语义层解耦，避免模板中出现分支判断。
 * 调用时机：模板渲染每一行 marker 时调用。
 * 问题/改进：未来支持词级时可扩展更多符号类型。
 */
function markerByKind(kind: DiffLine["kind"]): string {
  if (kind === "added") {
    return "+";
  }
  if (kind === "removed") {
    return "-";
  }
  return " ";
}
</script>
