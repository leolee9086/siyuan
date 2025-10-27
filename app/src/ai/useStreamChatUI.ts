import { ref, onUnmounted } from 'vue';

/**
 * 管理StreamChat组件的UI相关逻辑
 * 包括动画控制、状态显示等界面交互
 */
export function useStreamChatUI() {
    const showResponseContainer = ref(false);
    const statusText = ref('正在生成回复...');
    const statusColor = ref('var(--b3-theme-on-surface)');
    const dots = ref('');
    let dotsInterval: NodeJS.Timeout | null = null;

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

    const showResponse = () => {
        showResponseContainer.value = true;
        statusText.value = '正在生成回复...';
        statusColor.value = 'var(--b3-theme-on-surface)';
        startAnimation();
    };

    const hideResponse = () => {
        showResponseContainer.value = false;
    };

    const setCompleteStatus = () => {
        statusText.value = '生成完成';
    };

    const setErrorStatus = (error: Error) => {
        statusText.value = `生成失败: ${error.message}`;
        statusColor.value = 'var(--b3-theme-error)';
        console.error('Stream error:', error);
        
        if (error.message.includes('超时')) {
            statusText.value = '响应超时，但已保留已有内容';
            statusColor.value = 'var(--b3-theme-on-surface)';
        } else {
            setTimeout(() => {
                hideResponse();
            }, 3000);
        }
    };

    const setAbortStatus = () => {
        statusText.value = '已终止响应';
    };

    const focusTextarea = (textareaRef: { value: HTMLTextAreaElement | null }) => {
        textareaRef.value?.focus();
    };

    onUnmounted(() => {
        stopAnimation();
    });

    return {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        showResponse,
        hideResponse,
        setCompleteStatus,
        setErrorStatus,
        setAbortStatus,
        focusTextarea,
        stopAnimation
    };
}