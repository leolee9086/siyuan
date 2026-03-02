<template>
  <div class="persona-seed-convergence">
    <div class="persona-seed-convergence-header">
      <strong>双向收敛建议</strong>
      <span class="persona-seed-convergence-state">
        状态: {{ state }} / 待确认: {{ pendingCount }}
      </span>
    </div>
    <div class="persona-seed-convergence-controls">
      <button
        type="button"
        class="persona-seed-convergence-generate"
        :disabled="generating"
        @click="$emit('generate')"
      >
        {{ generating ? "生成中..." : "描述 -> 问卷建议" }}
      </button>
    </div>
    <p class="persona-seed-convergence-hint">
      当前已接入"描述 -> 问卷建议"LLM 入口；建议默认 pending，需手动确认后写入。
    </p>
    <p class="persona-seed-convergence-progress">
      描述进度: {{ progressText }} / 已接受: {{ acceptedCount }} / 已拒绝: {{ rejectedCount }}
    </p>
    <p v-if="summary" class="persona-seed-suggestion-preview">
      查看中: Q{{ summary.q }} / 当前: {{ summary.currentScoreText }} / 建议: {{ summary.suggestedScore }}
    </p>
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
import type { PersonaConvergenceSuggestion } from "../../../data/convergence/persona-seed-convergence.types";
import PersonaSeedSuggestionList from "./PersonaSeedSuggestionList.vue";

defineProps<{
  state: string;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  progressText: string;
  generating: boolean;
  suggestions: readonly PersonaConvergenceSuggestion[];
  summary: { q: number; currentScoreText: string; suggestedScore: number } | null;
}>();

defineEmits<{
  (e: "generate"): void;
  (e: "accept", id: string): void;
  (e: "reject", id: string): void;
  (e: "view", id: string): void;
}>();
</script>
