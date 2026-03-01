import { ref, onUnmounted } from "vue";
import type { StreamChatUIContext, StreamChatUIReturn } from "./streamChat.types";
import { forgeI18n } from "../util/siyuanEnvironments/forgeI18n.getI18n.environment";

type StreamChatTextKey =
    | "inputPlaceholder"
    | "cancel"
    | "appendToNote"
    | "respondingClickStop"
    | "generatingResponse"
    | "generationCompleted"
    | "responseStopped"
    | "generationFailedPrefix"
    | "timeoutWithRetainedContent"
    | "requestError";

const resolveI18nText = (value: unknown, fallback: string): string => {
    if (typeof value === "string") {
        return value;
    }
    return fallback;
};

export const getStreamChatI18nText = (key: StreamChatTextKey): string => {
    const chatI18n = forgeI18n.ai.聊天;
    const textMap: Record<StreamChatTextKey, string> = {
        inputPlaceholder: resolveI18nText(chatI18n.输入占位, "请输入内容"),
        cancel: resolveI18nText(chatI18n.取消, "取消"),
        appendToNote: resolveI18nText(chatI18n.追加到笔记, "追加到笔记"),
        respondingClickStop: resolveI18nText(chatI18n.响应中点击终止, "响应中...点击终止"),
        generatingResponse: resolveI18nText(chatI18n.正在生成回复, "正在生成回复..."),
        generationCompleted: resolveI18nText(chatI18n.生成完成, "生成完成"),
        responseStopped: resolveI18nText(chatI18n.已终止响应, "已终止响应"),
        generationFailedPrefix: resolveI18nText(chatI18n.生成失败前缀, "生成失败"),
        timeoutWithRetainedContent: resolveI18nText(chatI18n.响应超时保留内容, "响应超时，但已保留已有内容"),
        requestError: resolveI18nText(chatI18n.请求过程发生错误, "请求过程中发生错误")
    };
    return textMap[key];
};

/**
 * 开始动画函数
 * @param ctx UI上下文
 */
const startAnimation = (ctx: StreamChatUIContext) => {
    let dotCount = 0;
    ctx.dotsInterval.value = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        ctx.dots.value = ".".repeat(dotCount);
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
    ctx.dots.value = "";
};

/**
 * 显示响应函数
 * @param ctx UI上下文
 */
const showResponse = (ctx: StreamChatUIContext) => {
    ctx.showResponseContainer.value = true;
    ctx.statusText.value = getStreamChatI18nText("generatingResponse");
    ctx.statusColor.value = "var(--b3-theme-on-surface)";
    startAnimation(ctx);
};

/**
 * 设置错误状态函数
 * @param ctx UI上下文
 * @param error 错误对象
 */
const setErrorStatus = (ctx: StreamChatUIContext, error: Error) => {
    ctx.statusText.value = `${getStreamChatI18nText("generationFailedPrefix")}: ${error.message}`;
    ctx.statusColor.value = "var(--b3-theme-error)";
    console.error("Stream error:", error);

    if (error.message.includes("超时")) {
        ctx.statusText.value = getStreamChatI18nText("timeoutWithRetainedContent");
        ctx.statusColor.value = "var(--b3-theme-on-surface)";
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
    ctx.statusText.value = getStreamChatI18nText("responseStopped");
};

/**
 * 管理StreamChat组件的UI相关逻辑
 * 包括动画控制、状态显示等界面交互
 * @returns UI状态和控制函数
 */
export function useStreamChatUI(): StreamChatUIReturn {
    const showResponseContainer = ref(false);
    const statusText = ref(getStreamChatI18nText("generatingResponse"));
    const statusColor = ref("var(--b3-theme-on-surface)");
    const dots = ref("");
    const dotsInterval = ref<ReturnType<typeof setInterval> | null>(null);
    
    // 创建UI上下文对象
    const uiContext: StreamChatUIContext = {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        dotsInterval
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
        setCompleteStatus: () => {
            stopAnimation(uiContext);
            uiContext.statusText.value = getStreamChatI18nText("generationCompleted");
            uiContext.statusColor.value = "var(--b3-theme-on-surface)";
        },
        setErrorStatus: (error: Error) => setErrorStatus(uiContext, error),
        setAbortStatus: () => {
            stopAnimation(uiContext);
            setAbortStatus(uiContext);
        },
        stopAnimation: () => stopAnimation(uiContext)
    };
}
