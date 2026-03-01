/**
 * MessageBubble 组件逻辑上下文
 *
 * 从 MessageBubble.vue 提取的响应式状态和 watcher 逻辑。
 * 处理思考内容解析、时间格式化、流式消息光标更新和展开/折叠动画。
 */

// [TASK] T3.1 迁移基础UI组件 - MessageBubble逻辑提取

import { ref, watch, onMounted, nextTick, computed, type Ref } from "vue";
import {
    statusIconMap,
    isStreamingMessage,
    isStatusTransition,
} from "../../utils/messageFormat";
import {
    parseThinkContent,
    formatTimestamp,
    updateElementHeight,
} from "../../utils/messageHelpers";
import type { MessageBubbleProps } from "./MessageBubble.types";

/** 重导出 statusIconMap 供模板使用 */
export { statusIconMap };

/**
 * 解析消息内容中的思考标签并更新响应式状态
 *
 * 作用：将消息内容拆分为思考过程和普通回复
 * 意图：支持流式消息中<think>标签的实时解析
 * 调用时机：消息内容变化或状态转换时
 */
async function updateThinkState(
    content: string | undefined,
    thinkContent: Ref<string>,
    normalContent: Ref<string>,
    hasThinkContent: Ref<boolean>,
): Promise<void> {
    if (!content) {
        thinkContent.value = "";
        normalContent.value = "";
        hasThinkContent.value = false;
        return;
    }
    const result = await parseThinkContent(content);
    thinkContent.value = result.thinkContent;
    normalContent.value = result.normalContent;
    hasThinkContent.value = result.hasThink;
}

/**
 * 更新思考内容区域的DOM高度动画
 *
 * 作用：根据展开状态设置max-height实现折叠动画
 * 调用时机：思考内容出现或展开状态变化时
 */
async function applyThinkHeight(
    thinkContentRef: Ref<HTMLElement | null>,
    isThinkExpanded: Ref<boolean>,
): Promise<void> {
    await nextTick();
    if (!thinkContentRef.value) {
        return;
    }
    await updateElementHeight(thinkContentRef.value, isThinkExpanded.value);
}

/**
 * 注册消息内容和状态相关的watchers
 *
 * 作用：监听消息内容变化解析思考标签，监听状态转换重新解析
 * 调用时机：useMessageBubbleCtx 中调用一次
 */
async function setupContentWatchers(
    props: MessageBubbleProps,
    emit: (event: "cursor-update") => void,
    thinkContent: Ref<string>,
    normalContent: Ref<string>,
    hasThinkContent: Ref<boolean>,
): Promise<void> {
    // 消息内容变化时重新解析思考标签
    watch(
        () => props.msg?.content,
        (c) => updateThinkState(c, thinkContent, normalContent, hasThinkContent),
        { immediate: true },
    );

    // 消息状态从loading转为完成时重新解析内容
    // @内联回调
    watch(() => props.msg?.status, async (newStatus, oldStatus) => {
        if (!newStatus || !oldStatus || !props.msg?.content) {
            return;
        }
        const shouldReparse = await isStatusTransition(newStatus, oldStatus, props.msg.content);
        if (shouldReparse) {
            await updateThinkState(props.msg.content, thinkContent, normalContent, hasThinkContent);
        }
    });

    // 仅SSE流式消息内容变化时通知父组件更新光标位置
    watch(() => props.msg?.content, () => {
        // 只有sse_stream类型的消息在内容变化时才需要通知父组件滚动到最新位置
        if (props.msg?.type === "sse_stream") {
            emit("cursor-update");
        }
    }, { deep: true });
}

/**
 * 注册思考内容展开/折叠动画watchers
 *
 * 作用：当思考内容出现或展开状态变化时更新DOM高度
 * 调用时机：useMessageBubbleCtx 中调用一次
 */
async function setupThinkAnimationWatchers(
    thinkContentRef: Ref<HTMLElement | null>,
    isThinkExpanded: Ref<boolean>,
    hasThinkContent: Ref<boolean>,
): Promise<void> {
    watch(
        () => hasThinkContent.value,
        async (v) => {
            if (v) {
                await applyThinkHeight(thinkContentRef, isThinkExpanded);
            }
        },
    );
    watch(
        () => isThinkExpanded.value,
        () => applyThinkHeight(thinkContentRef, isThinkExpanded),
    );
}

/**
 * 初始化 MessageBubble 的全部响应式状态和副作用
 *
 * 作用：集中管理消息气泡的思考内容解析、时间格式化、光标更新和动画
 * 意图：将 Vue 组件的 script 逻辑提取为可测试的纯函数
 * 调用时机：MessageBubble.vue 的 setup 阶段调用一次
 */
export async function useMessageBubbleCtx(
    props: MessageBubbleProps,
    emit: (event: "cursor-update") => void,
) {
    const typeClass = computed(() => `type-${props.type}`);
    const formattedTime = ref("");
    const isThinkExpanded = ref(false);
    const thinkContent = ref("");
    const normalContent = ref("");
    const hasThinkContent = ref(false);
    const thinkContentRef = ref<HTMLElement | null>(null);

    watch(
        () => props.timestamp,
        async (ts) => {
            formattedTime.value = await formatTimestamp(ts);
        },
        { immediate: true },
    );

    await setupContentWatchers(props, emit, thinkContent, normalContent, hasThinkContent);
    await setupThinkAnimationWatchers(thinkContentRef, isThinkExpanded, hasThinkContent);

    // @内联回调
    onMounted(async () => {
        if (!props.msg) {
            return;
        }
        const streaming = await isStreamingMessage(props.msg);
        if (streaming) {
            emit("cursor-update");
        }
    });

    return {
        typeClass,
        formattedTime,
        isThinkExpanded,
        thinkContent,
        normalContent,
        hasThinkContent,
        thinkContentRef,
        /** 切换思考内容折叠/展开状态，由模板中的点击事件触发 */
        toggleThink: () => {
            isThinkExpanded.value = !isThinkExpanded.value;
        },
    };
}
