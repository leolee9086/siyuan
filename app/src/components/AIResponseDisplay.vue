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
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { AssistantResponseState } from '../ai/session/session.types';
import type { PropType } from 'vue';
import { processRender } from '../protyle/util/processCode';

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

// 渲染状态跟踪
let isRendering = false;
let pendingRender = false;

// 防抖函数
const debounce = (func: Function, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: any[]) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, delay);
    };
};

// 渲染代码块的函数
const renderCodeBlocks = async () => {
    // 如果已经在渲染中，标记为待处理并返回
    if (isRendering) {
        pendingRender = true;
        return;
    }
    
    isRendering = true;
    
    try {
        if (!responseContentRef.value) return;
        
        // 直接对整个响应内容容器进行处理
        processRender(responseContentRef.value);
        
        // 给浏览器一些时间处理渲染
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
        isRendering = false;
        
        // 如果有待处理的渲染请求，执行它
        if (pendingRender) {
            pendingRender = false;
            // 使用 nextTick 确保在下一个事件循环中执行
            nextTick(() => {
                renderCodeBlocks();
            });
        }
    }
};

// 防抖版本的渲染函数
const debouncedRender = debounce(renderCodeBlocks, 300);

// 监听内容变化
watch(() => props.state.blockDOMContent || props.state.responseContentStr, () => {
    // 等待DOM更新后再渲染
    nextTick(() => {
        debouncedRender();
    });
}, { immediate: false });

// 组件卸载时清理定时器
onUnmounted(() => {
    // 防抖函数会在内部清理定时器，这里不需要额外操作
});

defineExpose({
    responseContentRef
});
</script>