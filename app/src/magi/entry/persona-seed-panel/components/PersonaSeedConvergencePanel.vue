<template>
  <div class="persona-seed-convergence">
    <div class="persona-seed-convergence-header">
      <strong>双向收敛建议</strong>
      <span class="persona-seed-convergence-state">状态: {{ state }} / 待确认: {{ pendingCount }}</span>
    </div>
    <div class="persona-seed-convergence-controls">
      <button
        type="button"
        class="persona-seed-convergence-generate"
        :disabled="generatingDescriptionToQuestionnaire || generatingQuestionnaireToDescription"
        @click="$emit('generate-description-to-questionnaire')"
      >
        {{ generatingDescriptionToQuestionnaire ? "生成中..." : "描述 -> 问卷建议" }}
      </button>
      <button
        type="button"
        class="persona-seed-convergence-generate"
        :disabled="generatingDescriptionToQuestionnaire || generatingQuestionnaireToDescription"
        @click="$emit('generate-questionnaire-to-description')"
      >
        {{ generatingQuestionnaireToDescription ? "生成中..." : "问卷 -> 描述建议" }}
      </button>
    </div>
    <p class="persona-seed-convergence-hint">
      已接入双向建议；问卷 -> 描述使用专业简历辅助语气，且一次只更新一个侧面描述。
    </p>
    <p class="persona-seed-convergence-progress">
      描述进度: {{ progressText }} / 已接受: {{ acceptedCount }} / 已拒绝: {{ rejectedCount }}
    </p>
    <p v-if="summary" class="persona-seed-suggestion-preview">
      查看中: Q{{ summary.q }} / 当前: {{ summary.currentScoreText }} / 建议: {{ summary.suggestedScore }}
    </p>
    <p v-if="descriptionDiff" class="persona-seed-suggestion-preview">
      查看中: {{ descriptionDiff.fieldLabel }} / 行级差异预览
    </p>
    <LineDiffViewer
      v-if="descriptionDiff"
      :model="descriptionDiff.model"
      :title="`${descriptionDiff.fieldLabel}建议差异`"
      empty-text="建议应用后无可见变更"
    />
    <PersonaSeedSuggestionList
      v-if="suggestions.length > 0"
      :suggestions="suggestions"
      @accept="$emit('accept', $event)"
      @reject="$emit('reject', $event)"
      @view="$emit('view', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/** 用途：PersonaConvergenceSuggestion 人格收敛建议类型。使用范围：收敛结果展示组件。解耦评估：类型导入，不涉及运行时耦合。 */
import type { PersonaConvergenceSuggestion } from "../../../data/convergence/persona-seed-convergence.types";
/** 用途：DiffModel 差异模型类型。使用范围：收敛结果差异对比。解耦评估：类型导入，不涉及运行时耦合。 */
import type { DiffModel } from "../../../../util/diff/diff.types";
/** 用途：行级差异对比组件。使用范围：展示收敛前后的文本差异。解耦评估：Vue 组件依赖，通过直接导入使用。 */
import LineDiffViewer from "../../../../components/common/diff/LineDiffViewer.vue";
/** 用途：人格种子建议列表组件。使用范围：展示收敛建议供用户选择。解耦评估：同目录组件直接导入。 */
import PersonaSeedSuggestionList from "./PersonaSeedSuggestionList.vue";

defineProps<{
  state: string;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  progressText: string;
  generatingDescriptionToQuestionnaire: boolean;
  generatingQuestionnaireToDescription: boolean;
  suggestions: readonly PersonaConvergenceSuggestion[];
  summary: { q: number; currentScoreText: string; suggestedScore: number } | null;
  descriptionDiff: { field: string; fieldLabel: string; model: DiffModel } | null;
}>();

defineEmits<{
  (e: "generate-description-to-questionnaire"): void;
  (e: "generate-questionnaire-to-description"): void;
  (e: "accept", id: string): void;
  (e: "reject", id: string): void;
  (e: "view", id: string): void;
}>();
</script>
