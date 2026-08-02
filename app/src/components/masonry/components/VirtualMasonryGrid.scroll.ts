import { nextTick, ref, watch } from "vue";
import type { Ref } from "vue";

interface VirtualMasonryScrollMetrics {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

interface VirtualMasonryScrollControllerOptions {
    scrollContainer: Ref<HTMLElement | null>;
    scrollTop: Ref<number>;
    followOutput: Readonly<Ref<boolean>>;
    followThresholdPx: Readonly<Ref<number>>;
    ignoreScrollEventsFor: (durationMs: number) => void;
}

type VirtualMasonryScrollAnchor = ReturnType<typeof captureVirtualMasonryScrollAnchor>;

interface VirtualMasonryScrollAnchorState {
    savedAnchor: VirtualMasonryScrollAnchor | null;
    pendingRestoreFrame: number | null;
}

/** 捕获滚动位置时只记录稳定的绝对顶部或底部距离，避免内容高度变化放大比例误差。 */
export function captureVirtualMasonryScrollAnchor(metrics: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    followOutput: boolean;
    followThresholdPx: number;
}) {
    const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
    const scrollTop = Math.min(maxScrollTop, Math.max(0, metrics.scrollTop));
    const bottomDistance = Math.max(0, maxScrollTop - scrollTop);
    return {
        scrollTop,
        bottomDistance,
        stickToBottom: metrics.followOutput && bottomDistance <= metrics.followThresholdPx,
    };
}

/** 按捕获时的阅读意图恢复位置；普通阅读保持绝对顶部，贴底输出保持底部。 */
export function restoreVirtualMasonryScrollTop(
    anchor: VirtualMasonryScrollAnchor,
    metrics: { scrollHeight: number; clientHeight: number },
) {
    const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
    if (anchor.stickToBottom) {
        return maxScrollTop;
    }
    return Math.min(anchor.scrollTop, maxScrollTop);
}

function captureCurrentScrollAnchor(
    state: VirtualMasonryScrollAnchorState,
    options: VirtualMasonryScrollControllerOptions,
) {
    const container = options.scrollContainer.value;
    if (!container) {
        state.savedAnchor = null;
        return;
    }
    state.savedAnchor = captureVirtualMasonryScrollAnchor({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        followOutput: options.followOutput.value,
        followThresholdPx: options.followThresholdPx.value,
    });
}

function restoreSavedScrollAnchor(
    state: VirtualMasonryScrollAnchorState,
    options: VirtualMasonryScrollControllerOptions,
) {
    const anchor = state.savedAnchor;
    state.savedAnchor = null;
    if (!anchor) {
        return;
    }
    if (state.pendingRestoreFrame !== null) {
        cancelAnimationFrame(state.pendingRestoreFrame);
    }
    state.pendingRestoreFrame = requestAnimationFrame(() => {
        state.pendingRestoreFrame = null;
        const container = options.scrollContainer.value;
        if (!container) {
            return;
        }
        const nextScrollTop = restoreVirtualMasonryScrollTop(anchor, container);
        options.ignoreScrollEventsFor(80);
        container.scrollTop = nextScrollTop;
        options.scrollTop.value = nextScrollTop;
    });
}

function disposeScrollAnchorState(state: VirtualMasonryScrollAnchorState) {
    if (state.pendingRestoreFrame !== null) {
        cancelAnimationFrame(state.pendingRestoreFrame);
        state.pendingRestoreFrame = null;
    }
}

function getBottomDistance(metrics: VirtualMasonryScrollMetrics) {
    return Math.max(0, metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop);
}

function isNearBottom(options: VirtualMasonryScrollControllerOptions, container = options.scrollContainer.value) {
    if (!container) {
        return true;
    }
    return getBottomDistance(container) <= options.followThresholdPx.value;
}

async function scrollToBottom(
    options: VirtualMasonryScrollControllerOptions,
    shouldStickToBottom: Ref<boolean>,
    force = false,
) {
    await nextTick();
    const container = options.scrollContainer.value;
    if (!container) {
        return;
    }
    if (!force && options.followOutput.value && !shouldStickToBottom.value && !isNearBottom(options, container)) {
        return;
    }
    options.ignoreScrollEventsFor(80);
    container.scrollTop = container.scrollHeight;
    options.scrollTop.value = container.scrollTop;
    if (options.followOutput.value) {
        shouldStickToBottom.value = true;
    }
}

/** 管理布局重建锚点与流式贴底状态，组件只负责触发对应生命周期。 */
export function useVirtualMasonryScrollController(options: VirtualMasonryScrollControllerOptions) {
    const anchorState: VirtualMasonryScrollAnchorState = {
        savedAnchor: null,
        pendingRestoreFrame: null,
    };
    const shouldStickToBottom = ref(options.followOutput.value);
    watch(options.followOutput, (enabled) => {
        shouldStickToBottom.value = enabled ? isNearBottom(options) : false;
    }, { immediate: true });
    return {
        shouldStickToBottom,
        captureCurrentScrollAnchor: () => captureCurrentScrollAnchor(anchorState, options),
        restoreSavedScrollAnchor: () => restoreSavedScrollAnchor(anchorState, options),
        syncStickToBottomState: () => {
            if (options.followOutput.value) {
                shouldStickToBottom.value = isNearBottom(options);
            }
        },
        scrollToBottom: (force = false) => scrollToBottom(options, shouldStickToBottom, force),
        isNearBottom: (container?: HTMLElement | null) => isNearBottom(options, container),
        disposeScrollController: () => disposeScrollAnchorState(anchorState),
    };
}
