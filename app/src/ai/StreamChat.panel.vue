<template>
    <div class="b3-dialog__content">
        <textarea
            ref="textareaRef"
            class="b3-text-field fn__block"
            :placeholder="aiWritingText"
            v-model="inputValue"
            :disabled="isStreaming"
            @keydown.enter.prevent="handleConfirmClick"
        ></textarea>
        <div
            v-if="showResponseContainer"
            class="ai-response-container protyle-wysiwyg protyle-wysiwyg--attr"
            style="margin-top: 8px; padding: 8px; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: 4px; max-width: 60vw; max-height: 60vh; overflow: auto;"
        >
            <div class="ai-response-content" v-html="state.blockDOMContent || state.responseContentStr"></div>
            <div class="ai-response-status" style="margin-top: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
                <span class="ai-status-text" :style="{ color: statusColor }">{{ statusText }}</span>
                <span class="ai-status-dots">{{ dots }}</span>
            </div>
        </div>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="handleCancelClick">{{ cancelText }}</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" :style="{ color: confirmButtonColor }" @click="handleConfirmClick">
            {{ confirmButtonText }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import type { PropType } from 'vue';
import { ChatState, useStreamChatUI, handleAIRequest, handleFillContent, getI18nText } from './streamChat.componentLogic';

const props = defineProps({
    protyle: {
        type: Object as PropType<IProtyle>,
        required: true,
    },
    targetElement: {
        type: Object as PropType<Element>,
        required: true,
    },
    selectedElements: {
        type: Array as PropType<Element[]>,
        required: true,
    },
    dialog: {
        type: Object as PropType<{ destroy: () => void }>,
        required: true,
    }
});

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const inputValue = ref('');

const state = reactive<ChatState>({
    responseContentStr: '',
    isStreaming: false,
    isDone: false,
    abortFunction: null,
    blockDOMContent: '',
});

const isStreaming = computed(() => state.isStreaming);

// 使用UI composable管理界面相关逻辑
const {
    showResponseContainer,
    statusText,
    statusColor,
    dots,
    showResponse,
    hideResponse,
    setCompleteStatus,
    setErrorStatus,
    setAbortStatus,
    focusTextarea
} = useStreamChatUI();

// 获取国际化文本
const aiWritingText = getI18nText('aiWriting');
const cancelText = getI18nText('cancel');
const confirmText = getI18nText('confirm');

const confirmButtonText = computed(() => {
    if (state.isStreaming) return '响应中...点击终止';
    if (state.isDone) return confirmText;
    return confirmText;
});

const confirmButtonColor = computed(() => {
    return state.isStreaming ? 'var(--b3-theme-error)' : '';
});

const handleCancelClick = () => {
    if (state.abortFunction) {
        state.abortFunction();
    }
    props.dialog.destroy();
};

const handleConfirmClick = async () => {
    if (state.isStreaming) {
        if (state.abortFunction) {
            state.abortFunction();
        }
        return;
    }

    if (state.isDone) {
        handleFillContent(props.protyle, state, props.selectedElements, props.targetElement);
        props.dialog.destroy();
        return;
    }

    const abortFn = await handleAIRequest(
        inputValue.value,
        state,
        props.protyle,
        props.selectedElements,
        props.targetElement,
        showResponse,
        setCompleteStatus,
        setErrorStatus,
        setAbortStatus
    );
    
    if (abortFn) {
        state.abortFunction = abortFn;
    }
};

onMounted(() => {
    focusTextarea(textareaRef);
});
</script>