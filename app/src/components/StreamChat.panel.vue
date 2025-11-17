<template>
    <div class="b3-dialog__content">
        <div style="max-width: 60vw; max-height: 60vh; overflow: auto;">
            <template v-for="(taskState, index) in controller.taskStates" :key="index">
                <AIResponseDisplay :ref="el => setResponseDisplayRef(el, index)" :state="taskState"
                    :status-text="statusText.value" :status-color="statusColor.value" :dots="dots.value" />
            </template>
        </div>

        <TextField ref="textFieldRef" type="textarea" :placeholder="aiWritingText" v-model="inputValue"
            :disabled="isStreaming" @enter="() => controller.onConfirmClick(inputValue)"
            @ctrlEnter="() => controller.onCtrlEnterClick?.(inputValue)">
        </TextField>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="controller.onCancelClick">{{ cancelText }}</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" :style="{ color: confirmButtonColor }"
            @click="() => controller.onConfirmClick(inputValue)">
            {{ confirmButtonText }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { PropType } from 'vue';
import { useStreamChatUI, getI18nText } from './streamChat.ui';
import TextField from './common/TextField.vue';
import AIResponseDisplay from './AIResponseDisplay.vue';
import { AssistantResponseState } from '../ai/session/session.types';

const props = defineProps(
    {
        controller: {
            type: Object as PropType<{
                onCancelClick: () => void,
                onPauseClick: () => void,
                onResumeClick: () => void
                onConfirmClick: (inputValue: string) => Promise<void>
                onCtrlEnterClick: (inputValue: string) => Promise<void>
                taskStates:AssistantResponseState[]
            }>,
            required: true,
        }

    }
)
const textFieldRef = ref<InstanceType<typeof TextField> | null>(null);
const aiResponseDisplayRefs = ref<(InstanceType<typeof AIResponseDisplay> | null)[]>([]);
const inputValue = ref('');

const setResponseDisplayRef = (el: any, index: number) => {
    if (el && el.$el) {
        aiResponseDisplayRefs.value[index] = el;
    }
};

const isStreaming = computed(() => props.controller.taskStates.some(state => state.isStreaming));

// 使用UI composable管理界面相关逻辑
const {
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
const confirmText = getI18nText('追加到笔记');

const confirmButtonText = computed(() => {
    if (isStreaming.value) return '响应中...点击终止';
    if (props.controller.taskStates.every(state => state.isDone)) return confirmText;
    return confirmText;
});

const confirmButtonColor = computed(() => {
    return isStreaming.value ? 'var(--b3-theme-error)' : '';
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
        getResponseContentRef: () => aiResponseDisplayRefs.value[0]?.responseContentRef
    });
});
</script>