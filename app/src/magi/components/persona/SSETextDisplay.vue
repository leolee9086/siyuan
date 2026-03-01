<template>
  <div class="sse-display">
    <div class="sse-content">
      <div class="header-container">
        <h3>{{ systemName }} 提示词生成</h3>
        <button
          v-if="!isGenerating"
          class="generate-button"
          :disabled="isGenerating"
          @click="handleGenerate"
        >
          {{ textContent ? '重新生成' : '开始生成' }}
        </button>
        <div v-else class="generating-indicator">
          生成中...
        </div>
      </div>
      <div ref="textContainerRef" class="text-container">
        <template v-if="isGenerating">
          <p class="content">{{ textContent }}</p>
          <div class="generating-indicator">
            <span class="generating-dots" />
          </div>
        </template>
        <template v-else>
          <p v-if="error" class="error-message">{{ error }}</p>
          <p v-else-if="textContent" class="content">{{ textContent }}</p>
          <p v-else class="placeholder">点击"开始生成"按钮生成提示词</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { SSETextDisplayProps, SSETextDisplayEmits } from "./SSETextDisplay.types";
import { useSSETextDisplayCtx } from "./SSETextDisplay.ctx";
import "./SSETextDisplay.css";

const props = defineProps<SSETextDisplayProps>();
const emit = defineEmits<SSETextDisplayEmits>();

// defineExpose 必须在 await 之前调用，因此先声明需要暴露的 ref
const textContent = ref("");
const hasContent = computed(() => textContent.value.trim().length > 0);
defineExpose({ hasContent, textContent });

const {
    isGenerating, error,
    textContainerRef, handleGenerate,
} = await useSSETextDisplayCtx(props, emit, textContent);
</script>
