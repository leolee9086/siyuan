/**
 * SeelPanel 组件逻辑上下文
 *
 * 从 SeelPanel.vue 提取的响应式状态、尺寸计算和消息滚动逻辑。
 */

// [TASK] T3.1 迁移基础UI组件 - SeelPanel逻辑提取

import { computed, ref, onMounted, onUnmounted, type Ref } from "vue";
import type { SeelPanelProps } from "./SeelPanel.types";

/** 颜色名称到CSS颜色值的映射 */
const COLOR_MAP: Readonly<Record<string, string>> = {
    "red": "#ff3366",
    "blue": "#33ccff",
    "yellow": "#ffcc00",
    "rgba(255, 255, 255, 0.9)": "rgba(255, 255, 255, 0.9)",
};

/** 默认颜色（蓝色） */
const DEFAULT_COLOR = "#33ccff";

/**
 * 将颜色名称映射为CSS颜色值
 *
 * 作用：将贤者配置中的颜色标识转换为实际CSS颜色
 * 调用时机：SVG渲染时获取描边和填充颜色
 */
/** @同步豁免: 性能考虑 - 纯映射函数不涉及异步依赖，保持同步可避免不必要 await。 */
export function getColor(colorName: string): string {
    return COLOR_MAP[colorName] ?? DEFAULT_COLOR;
}

/**
 * 将SVG viewBox单位转换为像素值
 *
 * 作用：根据容器实际高度将SVG坐标系单位映射为像素
 * 调用时机：计算header和content区域的像素高度
 */
export async function svgToPixels(
    svgUnits: number,
    containerHeight: number,
): Promise<number> {
    return svgUnits * (containerHeight / 100);
}

/** 根据连接和加载状态返回CSS类名 */
function resolveStatusClass(ai: SeelPanelProps["ai"]): string {
    // 未连接时显示离线状态
    if (!ai.connected) {
        return "offline";
    }
    // 加载中显示loading状态
    if (ai.loading) {
        return "loading";
    }
    return "online";
}

/** 根据连接和加载状态返回显示文本 */
function resolveStatusText(ai: SeelPanelProps["ai"]): string {
    // 未连接时显示离线文本
    if (!ai.connected) {
        return "未连接";
    }
    // 加载中显示同步文本
    if (ai.loading) {
        return "同步中";
    }
    return "已连接";
}

/**
 * 初始化 SeelPanel 的响应式状态和尺寸观察
 *
 * 作用：管理面板容器尺寸、header/content高度计算、消息滚动
 * 调用时机：SeelPanel.vue 的 setup 阶段调用一次
 */
/** @同步豁免: 生命周期 - 需要在 setup 同步阶段返回容器引用供后续生命周期注册使用。 */
export function useSeelPanelCtx(
    props: SeelPanelProps,
) {
    const panelContainer = ref<HTMLElement | null>(null);
    const containerHeight = ref(0);

    const statusClass = computed(() => resolveStatusClass(props.ai));
    const statusText = computed(() => resolveStatusText(props.ai));

    const headerHeight = computed(() => containerHeight.value * 0.28);
    const contentHeight = computed(() => containerHeight.value * 0.72);

    const rootStyle = computed(() => ({
        "--header-height": `${headerHeight.value}px`,
        "--content-height": `${contentHeight.value}px`,
    }));

    return {
        panelContainer,
        containerHeight,
        statusClass,
        statusText,
        headerHeight,
        rootStyle,
    };
}

/**
 * 设置面板容器的ResizeObserver
 *
 * 作用：监听容器尺寸变化以更新SVG坐标到像素的映射
 * 调用时机：onMounted 中调用
 */
/** @同步豁免: 生命周期 - 必须在组件 setup 同步阶段注册 onMounted/onUnmounted。 */
export function setupResizeObserver(
    panelContainer: Ref<HTMLElement | null>,
    containerHeight: Ref<number>,
): ResizeObserver {
    const observer = new ResizeObserver((entries) => {
        // 仅在有有效观察条目时更新容器高度
        const entry = entries[0];
        if (entry) {
            containerHeight.value = entry.contentRect.height;
        }
    });

    onMounted(() => {
        // 容器挂载后开始观察尺寸变化
        if (panelContainer.value) {
            observer.observe(panelContainer.value);
        }
    });

    onUnmounted(() => {
        observer.disconnect();
    });

    return observer;
}

