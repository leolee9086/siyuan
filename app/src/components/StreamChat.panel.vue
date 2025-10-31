<template>
    <div class="b3-dialog__content">
        <div v-if="showResponseContainer" ref="internalResponseContentRef"
            class="ai-response-container protyle-wysiwyg protyle-wysiwyg--attr"
            style="margin-top: 8px; padding: 8px; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: 4px; max-width: 60vw; max-height: 60vh; overflow: auto;">
            <div class="ai-response-content" v-html="state.blockDOMContent || state.responseContentStr"></div>
            <div class="ai-response-status"
                style="margin-top: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
                <span class="ai-status-text" :style="{ color: statusColor }">{{ statusText }}</span>
                <span class="ai-status-dots">{{ dots }}</span>
            </div>
        </div>

        <TextField ref="textFieldRef" type="textarea" :placeholder="aiWritingText" v-model="inputValue"
            :disabled="isStreaming" @enter="() => onConfirmClick(inputValue)"></TextField>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="onCancelClick">{{ cancelText }}</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" :style="{ color: confirmButtonColor }"
            @click="() => onConfirmClick(inputValue)">
            {{ confirmButtonText }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { PropType } from 'vue';
import { useStreamChatUI, getI18nText } from './streamChat.componentLogic';
import TextField from './common/TextField.vue';

const props = defineProps({
    onCancelClick: {
        type: Function as PropType<() => void>,
        required: true,
    },
    onPauseClick: {
        type: Function as PropType<() => void>,
        required: false,
    },
    onResumeClick: {
        type: Function as PropType<() => void>,
        required: false,
    },
    onConfirmClick: {
        type: Function as PropType<(inputValue: string) => Promise<void>>,
        required: true,
    },
    state: {
        type: Object as PropType<any>,
        required: true,
    }
});

const textFieldRef = ref<InstanceType<typeof TextField> | null>(null);
const internalResponseContentRef = ref<HTMLElement | null>(null);
const inputValue = ref('');

const isStreaming = computed(() => props.state.isStreaming);

// 使用UI composable管理界面相关逻辑
const {
    showResponseContainer,
    statusText,
    statusColor,
    dots,
    showResponse,
    setCompleteStatus,
    setErrorStatus,
    setAbortStatus,
} = useStreamChatUI();

// 获取国际化文本
const aiWritingText = getI18nText('aiWriting');
const cancelText = getI18nText('cancel');
const confirmText = getI18nText('confirm');

const confirmButtonText = computed(() => {
    if (props.state.isStreaming) return '响应中...点击终止';
    if (props.state.isDone) return confirmText;
    return confirmText;
});

const confirmButtonColor = computed(() => {
    return props.state.isStreaming ? 'var(--b3-theme-error)' : '';
});

// 当UI函数准备好时，通知父组件
const emit = defineEmits(['ui-functions-ready', 'pauseClick', 'resumeClick']);
onMounted(() => {
    if (textFieldRef.value) {
        textFieldRef.value.focus();
    }

    // 通知父组件UI函数已准备好
    emit('ui-functions-ready', {
        showResponse,
        setCompleteStatus,
        setErrorStatus,
        setAbortStatus,
        getResponseContentRef: () => internalResponseContentRef.value
    });
});
</script>