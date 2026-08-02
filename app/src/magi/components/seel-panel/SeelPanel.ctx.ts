/**
 * SeelPanel 组件逻辑上下文。
 *
 * 集中管理卡片尺寸、活动列表、自动滚动、事件脉冲和投票徽标。
 */

/** 用途：创建派生状态。使用范围：SeelPanel setup 生命周期。解耦评估：由同目录网关转发 Vue API。 */
import { computed } from "./imports";
/** 用途：注册挂载生命周期。使用范围：ResizeObserver。解耦评估：由同目录网关转发 Vue API。 */
import { onMounted } from "./imports";
/** 用途：注册清理生命周期。使用范围：观察器和计时器释放。解耦评估：由同目录网关转发 Vue API。 */
import { onUnmounted } from "./imports";
/** 用途：创建组件局部引用。使用范围：容器、列表和脉冲状态。解耦评估：由同目录网关转发 Vue API。 */
import { ref } from "./imports";
/** 用途：响应活动变化。使用范围：滚动和脉冲副作用。解耦评估：由同目录网关转发 Vue API。 */
import { watch } from "./imports";
/** 用途：计算引用类型。使用范围：滚动 watcher 契约。解耦评估：仅用于静态类型。 */
import type { ComputedRef } from "./imports";
/** 用途：响应式引用类型。使用范围：DOM 和列表端口。解耦评估：仅用于静态类型。 */
import type { Ref } from "./imports";
/** 用途：活动流条目构建。使用范围：卡片虚拟列表。解耦评估：纯展示函数，无运行时状态。 */
import { buildSeelVirtualItems } from "./SeelPanelActivity.ctx";
/** 用途：活动条目高度估算。使用范围：虚拟列表布局。解耦评估：纯展示函数。 */
import { estimateSeelMessageHeight } from "./SeelPanelActivity.ctx";
/** 用途：工具参数格式化。使用范围：工具活动模板。解耦评估：纯展示函数。 */
import { formatToolCallArgs } from "./SeelPanelActivity.ctx";
/** 用途：工具名解析。使用范围：工具活动模板。解耦评估：纯展示函数。 */
import { getToolName } from "./SeelPanelActivity.ctx";
/** 用途：工具结果格式化。使用范围：工具活动模板。解耦评估：纯展示函数。 */
import { getToolOutput } from "./SeelPanelActivity.ctx";
/** 用途：工具阶段解析。使用范围：工具活动模板样式。解耦评估：纯展示函数。 */
import { getToolPhase } from "./SeelPanelActivity.ctx";
/** 用途：工具阶段文案。使用范围：工具活动模板。解耦评估：纯展示函数。 */
import { getToolPhaseLabel } from "./SeelPanelActivity.ctx";
/** 用途：工具活动识别。使用范围：消息模板分支。解耦评估：纯展示函数。 */
import { isToolActivity } from "./SeelPanelActivity.ctx";
/** 用途：可见活动变化标识。使用范围：卡片脉冲 watcher。解耦评估：纯展示函数。 */
import { resolveLatestActivityToken } from "./SeelPanelActivity.ctx";
/** 用途：投票徽标状态解析。使用范围：卡片覆盖层。解耦评估：投票展示属于本组件直接职责。 */
import { resolveSeelVoteBadgeState } from "./SeelPanelVoteContent.ctx";
/** 用途：事件发送端口。使用范围：徽标消隐。解耦评估：只描述组件边界。 */
import type { SeelPanelEmit } from "./SeelPanel.types";
/** 用途：虚拟列表端口。使用范围：自动滚动。解耦评估：避免依赖具体组件实例。 */
import type { SeelMessageListPort } from "./SeelPanel.types";
/** 用途：组件输入契约。使用范围：全部派生状态。解耦评估：同目录稳定边界。 */
import type { SeelPanelProps } from "./SeelPanel.types";
/** 用途：虚拟列表条目类型。使用范围：滚动 watcher。解耦评估：同目录稳定边界。 */
import type { SeelVirtualListItem } from "./SeelPanel.types";

const HEADER_HEIGHT_RATIO = 0.17;
const MIN_HEADER_HEIGHT = 52;
const MAX_HEADER_HEIGHT = 72;
// 由最小头部高度 52 与默认卡片高度 240 的比例得出。
const DEFAULT_HEADER_DIVIDER_Y = 21.6666666667;
const EVENT_PULSE_DURATION_MS = 780;

/** 将贤人颜色标识映射为实际 CSS 颜色。 */
/** 用途：贤人颜色标识到 CSS 颜色的映射。使用范围：SeelPanel 卡片边框与其他 MAGI 面板（如 MagiWorkspace 集群主色）。解耦评估：纯展示函数，跨模块复用。 */
export function getColor(colorName: string) {
    if (colorName === "red") {
        return "#ff3366";
    }
    if (colorName === "yellow") {
        return "#ffcc00";
    }
    return colorName === "rgba(255, 255, 255, 0.9)"
        ? "rgba(255, 255, 255, 0.9)"
        : "#33ccff";
}

/** 根据连接状态返回卡片状态类。 */
function resolveStatusClass(ai: SeelPanelProps["ai"]) {
    if (ai.connectionStatus === "connecting") {
        return "loading";
    }
    if (ai.connectionStatus === "connected") {
        return "online";
    }
    return "offline";
}

/** 根据连接和主导状态返回卡片状态文本。 */
function resolveStatusText(ai: SeelPanelProps["ai"], isDominant: boolean) {
    if (ai.connectionStatus === "connecting") {
        return "连接中";
    }
    if (ai.connectionStatus === "connected") {
        return isDominant ? "已连接|主要" : "已连接|辅助";
    }
    return "未连接";
}

/** 在组件生命周期内观察卡片高度。 */
function setupResizeObserver(
    panelContainer: Ref<HTMLElement | null>,
    containerHeight: Ref<number>,
) {
    const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
            containerHeight.value = entry.contentRect.height;
        }
    });
    onMounted(() => {
        if (panelContainer.value) {
            observer.observe(panelContainer.value);
        }
    });
    onUnmounted(() => observer.disconnect());
}

/** 注册显示、条目和流式内容变化后的列表跟随。 */
function setupScrollWatchers(
    props: SeelPanelProps,
    virtualItems: ComputedRef<SeelVirtualListItem[]>,
    messageListRef: Ref<SeelMessageListPort | null>,
) {
    // @内联回调
    watch(
        () => props.showMessages,
        async (showMessages) => {
            if (!showMessages) {
                return;
            }
            await messageListRef.value?.refreshLayout();
            await messageListRef.value?.scrollToBottom();
        },
        { immediate: true },
    );
    watch(
        () => virtualItems.value.length,
        async () => {
            if (props.showMessages) {
                await messageListRef.value?.scrollToBottom();
            }
        },
    );
}

/** 创建随最新语义活动延长的短暂卡片脉冲。 */
function useEventPulse(props: SeelPanelProps) {
    const isEventActive = ref(false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let deadline = 0;

    /** 释放当前脉冲计时器。 */
    // @柯里化
    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    /** 安排脉冲结束；连续活动会延长同一次视觉反馈。 */
    // @柯里化
    const finishPulse = () => {
        // 新活动延长 deadline 时保留同一次脉冲，避免旧计时器提前关闭反馈。
        if (Date.now() + 16 < deadline) {
            scheduleReset();
            return;
        }
        isEventActive.value = false;
        clearTimer();
    };

    // @柯里化
    const scheduleReset = () => {
        clearTimer();
        // 脉冲是明确的用户感知动画时长，连续活动会更新 deadline，因此需要按剩余时间重新调度。
        timer = setTimeout(finishPulse, Math.max(0, deadline - Date.now()));
    };

    // @内联回调
    watch(
        () => resolveLatestActivityToken(props.ai.messages),
        (token, previousToken) => {
            if (!token || token === previousToken) {
                return;
            }
            deadline = Date.now() + EVENT_PULSE_DURATION_MS;
            isEventActive.value = true;
            scheduleReset();
        },
    );
    onUnmounted(clearTimer);
    return isEventActive;
}

/** 创建尺寸、状态、样式和活动条目等无副作用派生状态。 */
function createPanelPresentationState(
    props: SeelPanelProps,
    containerHeight: Ref<number>,
) {
    const showFrame = computed(() => props.showFrame !== false);
    const statusClass = computed(() => resolveStatusClass(props.ai));
    const statusText = computed(() => resolveStatusText(props.ai, props.isDominant === true));
    const headerHeight = computed(() => Math.max(
        MIN_HEADER_HEIGHT,
        Math.min(MAX_HEADER_HEIGHT, Math.round(containerHeight.value * HEADER_HEIGHT_RATIO)),
    ));
    const headerDividerY = computed(() => containerHeight.value > 0
        ? Number(((headerHeight.value / containerHeight.value) * 100).toFixed(3))
        : DEFAULT_HEADER_DIVIDER_Y);
    return {
        showFrame,
        statusClass,
        statusText,
        headerDividerY,
        rootStyle: computed(() => ({
            "--header-height": `${headerHeight.value}px`,
            "--content-height": `${Math.max(0, containerHeight.value - headerHeight.value)}px`,
        })),
        virtualItems: computed(() => buildSeelVirtualItems(
            props.ai.messages,
            props.ai.loading,
            props.ai.config.name,
        )),
        colorValue: computed(() => props.frameColor || getColor(props.ai.config.color)),
    };
}

/**
 * 初始化 SeelPanel 的响应式状态和副作用。
 *
 * 作用：为组件提供尺寸、活动列表、滚动、工具展示和投票徽标绑定。
 * 意图：让 Vue 文件只保留声明式模板，不持有活动流业务细节。
 * 调用时机：SeelPanel setup 阶段调用一次。
 */
/** @同步豁免: 生命周期 - 必须在 setup 同步阶段注册 watcher 和清理逻辑。 */
export function useSeelPanelCtx(props: SeelPanelProps, emit: SeelPanelEmit) {
    const panelContainer = ref<HTMLElement | null>(null);
    const containerHeight = ref(0);
    const messageListRef = ref<SeelMessageListPort | null>(null);
    const presentation = createPanelPresentationState(props, containerHeight);
    const activeVoteBadge = computed(() => resolveSeelVoteBadgeState(
        props.ai.messages,
        props.ai.config.name,
    ));
    const visibleVoteBadge = computed(() => {
        const badge = activeVoteBadge.value;
        return badge && badge.token !== props.dismissedVoteBadgeToken ? badge : null;
    });
    const isEventActive = useEventPulse(props);
    /** 流式内容增长时让活动列表跟随到末尾。 */
    // @柯里化
    const handleCursorUpdate = async () => messageListRef.value?.scrollToBottom();
    /** 点击徽标时按当前轮次 token 通知父级消隐。 */
    // @柯里化
    const dismissVoteBadges = () => {
        if (activeVoteBadge.value) {
            emit("dismiss-vote-badges", activeVoteBadge.value.token);
        }
    };

    setupResizeObserver(panelContainer, containerHeight);
    setupScrollWatchers(props, presentation.virtualItems, messageListRef);

    return {
        panelContainer,
        messageListRef,
        ...presentation,
        visibleVoteBadge,
        isEventActive,
        estimateMessageHeight: estimateSeelMessageHeight,
        isToolActivity,
        getToolName,
        getToolPhase,
        getToolPhaseLabel,
        getToolOutput,
        formatToolCallArgs,
        handleCursorUpdate,
        dismissVoteBadges,
    };
}
