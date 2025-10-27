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
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import type { PropType } from 'vue';
import { ChatState } from './chatStream.types';
import { buildAIRequest, buildRequestHeaders, handleOpenAILikeStreamResponse, updateChatState } from './chatStream.utils';
import { universalStreamRequest } from '../util/fetchStream';
import { getAIConfigFromSiyuan } from './types';
import { fillContent } from './actions.fillContent';
import { getContenteditableElement } from '../protyle/wysiwyg/getBlock';
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
const showResponseContainer = ref(false);
const statusText = ref('正在生成回复...');
const statusColor = ref('var(--b3-theme-on-surface)');
const dots = ref('');
let dotsInterval: NodeJS.Timeout | null = null;

const state = reactive<ChatState>({
    responseContentStr: '',
    isStreaming: false,
    isDone: false,
    abortFunction: null,
    blockDOMContent: '',
});

const isStreaming = computed(() => state.isStreaming);


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

const startAnimation = () => {
    let dotCount = 0;
    dotsInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        dots.value = '.'.repeat(dotCount);
    }, 500);
};

const stopAnimation = () => {
    if (dotsInterval) {
        clearInterval(dotsInterval);
        dotsInterval = null;
    }
    dots.value = '';
};

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

    showResponseContainer.value = true;
    statusText.value = '正在生成回复...';
    statusColor.value = 'var(--b3-theme-on-surface)';
    startAnimation();

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
                    stopAnimation();
                    statusText.value = '生成完成';
                },
                onError: (error) => {
                    updateChatState(state, { isStreaming: false, abortFunction: null });
                    stopAnimation();
                    statusText.value = `生成失败: ${error.message}`;
                    statusColor.value = 'var(--b3-theme-error)';
                    console.error('Stream error:', error);
                    if (error.message.includes('超时') && state.responseContentStr) {
                        statusText.value = '响应超时，但已保留已有内容';
                        statusColor.value = 'var(--b3-theme-on-surface)';
                    } else {
                        setTimeout(() => {
                            showResponseContainer.value = false;
                        }, 3000);
                    }
                },
                onAbort: () => {
                    updateChatState(state, { isStreaming: false, abortFunction: null });
                    stopAnimation();
                    statusText.value = '已终止响应';
                },
            }
        );
        updateChatState(state, { abortFunction: abortFn });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '请求失败';
        updateChatState(state, { isStreaming: false });
        stopAnimation();
        statusText.value = errorMessage;
        statusColor.value = 'var(--b3-theme-error)';
        setTimeout(() => {
            showResponseContainer.value = false;
        }, 3000);
    }
};

onMounted(() => {
    textareaRef.value?.focus();
});

onUnmounted(() => {
    stopAnimation();
});
</script>