<template>
  <div class="sse-stream">
    <div v-show="hasThinkContent" class="think-section">
      <div class="think-header" @click="$emit('toggle-think')">
        <span class="think-icon">{{ isThinkExpanded ? '▼' : '▶' }}</span>
        <span class="think-title">{{ thinkingProcessText }}</span>
      </div>
      <div
        class="think-content"
        :class="{ 'expanded': isThinkExpanded }"
        ref="thinkContentRef"
      >
        <MagiWebContent :content="thinkContent" />
      </div>
    </div>
    <MagiWebContent
      class="stream-content protyle-wysiwyg"
      :content="normalContent || msg?.content || initializingNeuralLinkText"
      :meta="msg?.meta"
    />
    <span
      v-if="msg?.status === 'loading'"
      class="stream-cursor animate-pulse"
    >█</span>
  </div>
</template>

<script setup lang="ts">
import type { MagiMessageView } from "../../entry/magiView.types";
import { getMagiI18nText } from "../../utils/magiI18n";
import MagiWebContent from "./MagiWebContent.vue";

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
    msg?: MagiMessageView;
}>();

defineEmits<{
    "toggle-think": [];
}>();


/** 思考内容DOM引用，由父组件通过ref获取 */
const thinkContentRef = defineModel<HTMLElement | null>("thinkContentRef");
const thinkingProcessText = getMagiI18nText("thinkingProcess");
const initializingNeuralLinkText = getMagiI18nText("initializingNeuralLink");
</script>
