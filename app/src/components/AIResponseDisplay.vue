<template>
    <div v-if="showContainer" ref="responseContentRef"
        class="ai-response-container protyle-wysiwyg protyle-wysiwyg--attr"
        style="margin-top: 8px; padding: 8px; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: 4px; max-width: 60vw; max-height: 60vh; overflow: auto;">
        <div class="ai-response-content" v-html="state.blockDOMContent || state.responseContentStr"></div>
        <div class="ai-response-status" style="margin-top: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
            <span class="ai-status-text" :style="{ color: statusColor }">{{ statusText }}</span>
            <span class="ai-status-dots">{{ dots }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AssistantResponseState } from '../ai/session/session.types';
import type { PropType } from 'vue';

// 定义组件属性
const props = defineProps({
    showContainer: {
        type: Boolean,
        default: false
    },
    state: {
        type: Object as PropType<AssistantResponseState>,
        default: ''
    },
    statusText: {
        type: String,
        default: ''
    },
    statusColor: {
        type: String,
        default: 'var(--b3-theme-on-surface)'
    },
    dots: {
        type: String,
        default: ''
    }
});

// 暴露ref给父组件
const responseContentRef = ref<HTMLElement | null>(null);

defineExpose({
    responseContentRef
});
</script>