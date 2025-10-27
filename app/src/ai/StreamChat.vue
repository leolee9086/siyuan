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
import { ChatState } from './chatStream.types';
import { buildAIRequest, buildRequestHeaders, handleOpenAILikeStreamResponse, updateChatState } from './chatStream.utils';
import { universalStreamRequest } from '../util/fetchStream';
import { getAIConfigFromSiyuan } from './types';
import { fillContent } from './actions.fillContent';
import { getContenteditableElement } from '../protyle/wysiwyg/getBlock';
import { useStreamChatUI } from './useStreamChatUI';
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

// 获取思源语言文本的辅助函数
const getI18n = (key: string) => {
  return window.siyuan.languages?.[key];
};

const aiWritingText = getI18n('aiWriting');
const cancelText = getI18n('cancel');
const confirmText = getI18n('confirm');

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
        const targetElements = props.selectedElements.length > 0 ? props.selectedElements : [props.targetElement];
        fillContent(props.protyle, state.responseContentStr, targetElements, state.blockDOMContent);
        props.dialog.destroy();
        return;
    }

    await executeAIRequest();
};

const executeAIRequest = async () => {
    if (!inputValue.value) return;
    showResponse();
    updateChatState(state, {
        responseContentStr: '',
        isStreaming: true,
        isDone: false,
    });
    try {
        const aiConfig = getAIConfigFromSiyuan();
        let blockContents: string[] = [];
        if (props.selectedElements.length > 0) {
            props.selectedElements.forEach(blockElement => {
                const editableElement = getContenteditableElement(blockElement);
                if (editableElement) {
                    blockContents.push(editableElement.textContent || '');
                }
            });
        }
        const requestBody = buildAIRequest(inputValue.value, blockContents);
        const headers = buildRequestHeaders();
        const abortFn = await universalStreamRequest(
            {
                url: `${aiConfig.apiBaseURL}/chat/completions`,
                method: 'POST',
                headers: headers,
                body: requestBody,
                timeout: aiConfig.apiTimeout,
            },
            {
                onMessage: (dataStr) => handleOpenAILikeStreamResponse(dataStr, state, null, props.protyle),
                onDone: () => {
                    updateChatState(state, { isStreaming: false, isDone: true, abortFunction: null });
                    setCompleteStatus();
                },
                onError: (error) => {
                    updateChatState(state, { isStreaming: false, abortFunction: null });
                    setErrorStatus(error);
                },
                onAbort: () => {
                    updateChatState(state, { isStreaming: false, abortFunction: null });
                    setAbortStatus();
                },
            }
        );
        updateChatState(state, { abortFunction: abortFn });
    } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error('请求失败');
        updateChatState(state, { isStreaming: false });
        setErrorStatus(errorMessage);
    }
};

onMounted(() => {
    focusTextarea(textareaRef);
});
</script>