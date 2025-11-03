import { ref, onUnmounted } from 'vue';
import type { StreamChatUIContext, StreamChatUIReturn } from './streamChat.types';

/**
 * 开始动画函数
 * @param ctx UI上下文
 */
const startAnimation = (ctx: StreamChatUIContext) => {
    let dotCount = 0;
    ctx.dotsInterval.value = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        ctx.dots.value = '.'.repeat(dotCount);
    }, 500);
};

/**
 * 停止动画函数
 * @param ctx UI上下文
 */
const stopAnimation = (ctx: StreamChatUIContext) => {
    if (ctx.dotsInterval.value) {
        clearInterval(ctx.dotsInterval.value);
        ctx.dotsInterval.value = null;
    }
    ctx.dots.value = '';
};

/**
 * 显示响应函数
 * @param ctx UI上下文
 */
const showResponse = (ctx: StreamChatUIContext) => {
    ctx.showResponseContainer.value = true;
    ctx.statusText.value = '正在生成回复...';
    ctx.statusColor.value = 'var(--b3-theme-on-surface)';
    startAnimation(ctx);
};

/**
 * 设置错误状态函数
 * @param ctx UI上下文
 * @param error 错误对象
 */
const setErrorStatus = (ctx: StreamChatUIContext, error: Error) => {
    ctx.statusText.value = `生成失败: ${error.message}`;
    ctx.statusColor.value = 'var(--b3-theme-error)';
    console.error('Stream error:', error);

    if (error.message.includes('超时')) {
        ctx.statusText.value = '响应超时，但已保留已有内容';
        ctx.statusColor.value = 'var(--b3-theme-on-surface)';
    } else {
        setTimeout(() => {
            ctx.showResponseContainer.value = false;
        }, 3000);
    }
};

/**
 * 设置终止状态函数
 * @param ctx UI上下文
 */
const setAbortStatus = (ctx: StreamChatUIContext) => {
    ctx.statusText.value = '已终止响应';
};

/**
 * 获取国际化文本的辅助函数
 * @param key 文本键
 * @returns 国际化文本
 */
export const getI18nText = (key: string): string => {
    return window.siyuan.languages?.[key] || key;
};

/**
 * 管理StreamChat组件的UI相关逻辑
 * 包括动画控制、状态显示等界面交互
 * @returns UI状态和控制函数
 */
export function useStreamChatUI(): StreamChatUIReturn {
    const showResponseContainer = ref(false);
    const statusText = ref('正在生成回复...');
    const statusColor = ref('var(--b3-theme-on-surface)');
    const dots = ref('');
    let dotsInterval: NodeJS.Timeout | null = null;
    
    // 创建UI上下文对象
    const uiContext: StreamChatUIContext = {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        dotsInterval: { value: dotsInterval }
    };
    
    onUnmounted(() => {
        stopAnimation(uiContext);
    });

    return {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        showResponse: () => showResponse(uiContext),
        setCompleteStatus: () => { uiContext.statusText.value = '生成完成'; },
        setErrorStatus: (error: Error) => setErrorStatus(uiContext, error),
        setAbortStatus: () => setAbortStatus(uiContext),
        stopAnimation: () => stopAnimation(uiContext)
    };
}