<template>
  <div class="sse-stream">
    <div v-show="hasThinkContent" class="think-section">
      <div class="think-header" @click="$emit('toggle-think')">
        <span class="think-icon">{{ isThinkExpanded ? '▼' : '▶' }}</span>
        <span class="think-title">思考过程</span>
      </div>
      <div
        class="think-content"
        :class="{ 'expanded': isThinkExpanded }"
        ref="thinkContentRef"
      >
        {{ thinkContent }}
      </div>
    </div>
    <div class="stream-content">
      {{ normalContent || msg?.content || '初始化神经连接...' }}
    </div>
    <span
      v-if="msg?.status === 'loading'"
      class="stream-cursor animate-pulse"
    >█</span>
  </div>
</template>

<script setup lang="ts">
import type { MagiMessage } from "../../utils/messageFactory.types";

defineProps<{
    /** 思考内容文本 */
    thinkContent: string;
    /** 普通回复文本 */
    normalContent: string;
    /** 是否包含思考内容 */
    hasThinkContent: boolean;
    /** 思考内容是否展开 */
    isThinkExpanded: boolean;
    /** 完整消息对象 */
    msg?: MagiMessage;
}>();

defineEmits<{
    "toggle-think": [];
}>();

/** 思考内容DOM引用，由父组件通过ref获取 */
const thinkContentRef = defineModel<HTMLElement | null>("thinkContentRef");
</script>
