<template>
  <ul class="persona-seed-suggestion-list">
    <li v-for="s in suggestions" :key="s.id" class="persona-seed-suggestion-item">
      <div class="persona-seed-suggestion-meta">
        <span>{{ s.source }} -> {{ s.target }}</span>
        <span>{{ s.status }}</span>
      </div>
      <p class="persona-seed-suggestion-reason">{{ s.reason }}</p>
      <div class="persona-seed-suggestion-actions">
        <button type="button" :disabled="s.status === 'accepted'" @click="$emit('accept', s.id)">
          接受
        </button>
        <button type="button" :disabled="s.status === 'rejected'" @click="$emit('reject', s.id)">
          拒绝
        </button>
        <button
          type="button"
          class="persona-seed-suggestion-view"
          :disabled="s.payload.kind !== 'questionnaire_answer'"
          @click="$emit('view', s.id)"
        >
          查看
        </button>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { PersonaConvergenceSuggestion } from "../../../data/convergence/persona-seed-convergence.types";

defineProps<{
  suggestions: readonly PersonaConvergenceSuggestion[];
}>();

defineEmits<{
  (e: "accept", id: string): void;
  (e: "reject", id: string): void;
  (e: "view", id: string): void;
}>();
</script>
